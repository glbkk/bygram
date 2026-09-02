import type { BygramMusicAlbum, BygramMusicTrack } from './musicTypes';

const SC_ORIGIN = 'https://soundcloud.com';
const SC_API = 'https://api-v2.soundcloud.com';
const CLIENT_ID_CACHE_KEY = 'bygram-sc-client-id-v1';
const CLIENT_ID_TTL_MS = 12 * 60 * 60 * 1000;
const RELAY_TIMEOUT_MS = 14_000;
// Public web-app client_id from SoundCloud's own frontend — not a user/app secret.
const BOOTSTRAP_CLIENT_ID = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
const CLIENT_ID_RE = new RegExp([
  String.raw`client_id\s*[:=]\s*["']([0-9a-zA-Z]{32})["']`,
  String.raw`"client_id"\s*:\s*"([0-9a-zA-Z]{32})"`,
  String.raw`clientId["']?\s*[:=]\s*["']([0-9a-zA-Z]{32})["']`,
].join('|'));

type ClientIdCache = { value: string; fetchedAt: number };
type MappedTrack = BygramMusicTrack & {
  isPreview?: boolean;
  playbackCount?: number;
  likesCount?: number;
};

let memoryClientId: ClientIdCache | undefined;
let clientIdRefreshInflight: Promise<void> | undefined;

/**
 * SoundCloud for a static open-source PWA: no registrations, no API keys, no hosted backends.
 * Metadata goes through public CORS relays raced in parallel; audio plays directly from sndcdn.
 */
export async function scSearchTracks(query: string, limit = 40): Promise<BygramMusicTrack[]> {
  const payload = await scApiGet('/search/tracks', {
    q: query,
    limit: String(Math.min(Math.max(limit, 24), 50)),
    linked_partitioning: '1',
  });
  return rankTracks(
    (payload.collection || []).map(mapTrack).filter(Boolean) as MappedTrack[],
    query,
  ).slice(0, limit);
}

export async function scSearchAlbums(query: string, limit = 12): Promise<BygramMusicAlbum[]> {
  const payload = await scApiGet('/search/playlists', {
    q: query,
    limit: String(Math.min(limit, 16)),
    linked_partitioning: '1',
  });
  return (payload.collection || [])
    .map(mapPlaylistAlbum)
    .filter(Boolean)
    .slice(0, limit) as BygramMusicAlbum[];
}

export async function scSearch(query: string, limit = 40): Promise<{
  tracks: BygramMusicTrack[];
  albums: BygramMusicAlbum[];
}> {
  const [tracks, albums] = await Promise.all([
    scSearchTracks(query, limit),
    scSearchAlbums(query, 12).catch(() => [] as BygramMusicAlbum[]),
  ]);
  const derived = groupScAlbums(tracks).filter((album) => album.trackCount >= 2).slice(0, 8);
  const mergedAlbums = dedupeAlbums([...albums, ...derived]).slice(0, 16);
  return { tracks, albums: mergedAlbums };
}

export async function scHomeTracks(limit = 20): Promise<{ daily: BygramMusicTrack[]; wave: BygramMusicTrack[] }> {
  // One charts request only — related/wave used to double the relay latency on first paint.
  const charts = await scApiGet('/charts', {
    kind: 'trending',
    genre: 'soundcloud:genres:all-music',
    limit: String(limit),
    linked_partitioning: '1',
  });
  const daily = rankTracks(
    (charts.collection || [])
      .map((entry: { track?: unknown }) => mapTrack(entry.track || entry))
      .filter(Boolean) as MappedTrack[],
  ).slice(0, 20);

  return { daily, wave: daily };
}

export async function scRelatedTracks(trackId: string, limit = 40): Promise<BygramMusicTrack[]> {
  const numericId = stripScId(trackId);
  const related = await scApiGet(`/tracks/${numericId}/related`, {
    limit: String(limit),
    linked_partitioning: '1',
  });
  const seed = (await scTracksByIds([numericId]))[0];
  const list = [seed, ...(related.collection || []).map(mapTrack)].filter(Boolean);
  return dedupeTracks(rankTracks(list as MappedTrack[])).slice(0, limit);
}

export async function scTracksByIds(ids: string[]): Promise<BygramMusicTrack[]> {
  const numeric = Array.from(new Set(ids.map(stripScId).filter(Boolean))).slice(0, 40);
  if (!numeric.length) return [];
  const payload = await scApiGet('/tracks', { ids: numeric.join(',') });
  const list = Array.isArray(payload) ? payload : (payload.collection || []);
  return rankTracks(list.map(mapTrack).filter(Boolean) as MappedTrack[]);
}

export async function scPlaylistTracks(playlistId: string): Promise<BygramMusicAlbum | undefined> {
  const numericId = stripScId(playlistId);
  if (!numericId) return undefined;
  const raw = await scApiGet(`/playlists/${numericId}`, { representation: 'full' });
  const album = mapPlaylistAlbum(raw);
  if (!album) return undefined;
  const tracks = rankTracks((raw.tracks || []).map(mapTrack).filter(Boolean) as MappedTrack[]);
  return { ...album, tracks, trackCount: tracks.length || album.trackCount };
}

export async function scResolveStream(trackId: string): Promise<{
  track: BygramMusicTrack;
  streamUrl: string;
  mimeType: string;
}> {
  const numericId = stripScId(trackId);
  const raw = await scApiGet(`/tracks/${numericId}`);
  const track = mapTrack(raw);
  if (!track) throw new Error('TRACK_UNAVAILABLE');

  const transcodings = raw?.media?.transcodings || [];
  const progressive = transcodings.find((item: { format?: { protocol?: string; mime_type?: string } }) => (
    item?.format?.protocol === 'progressive'
    && String(item?.format?.mime_type || '').includes('mpeg')
  )) || transcodings.find((item: { format?: { protocol?: string } }) => (
    item?.format?.protocol === 'progressive'
  ));
  if (!progressive?.url) throw new Error('STREAM_UNAVAILABLE');

  const clientId = getClientIdSync();
  const resolveUrl = new URL(progressive.url);
  resolveUrl.searchParams.set('client_id', clientId);
  if (raw.track_authorization) {
    resolveUrl.searchParams.set('track_authorization', raw.track_authorization);
  }

  const resolved = await fetchJsonViaRelay(resolveUrl.toString());
  if (!resolved?.url) throw new Error('STREAM_UNAVAILABLE');
  const { isPreview: _isPreview, playbackCount: _pc, likesCount: _lc, ...cleanTrack } = track;
  return {
    track: cleanTrack,
    streamUrl: resolved.url,
    mimeType: progressive.format?.mime_type || 'audio/mpeg',
  };
}

export function groupScAlbums(tracks: BygramMusicTrack[]): BygramMusicAlbum[] {
  const groups = new Map<string, BygramMusicTrack[]>();
  tracks.forEach((track) => {
    const title = track.album || 'SoundCloud';
    const key = `${normalize(track.artist)}:${normalize(title)}`;
    groups.set(key, [...(groups.get(key) || []), track]);
  });
  return Array.from(groups, ([id, albumTracks]) => ({
    id: `sc-album:${id}`,
    title: albumTracks[0].album || 'SoundCloud',
    artist: albumTracks[0].artist,
    artworkUrl: albumTracks.find((track) => track.artworkUrl)?.artworkUrl,
    trackCount: albumTracks.length,
    tracks: albumTracks,
  }));
}

async function scApiGet(pathname: string, query: Record<string, string> = {}) {
  const clientId = getClientIdSync();
  scheduleClientIdRefresh();
  const url = new URL(`${SC_API}${pathname}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('client_id', clientId);

  try {
    return await fetchJsonViaRelay(url.toString());
  } catch {
    invalidateClientId();
    writeClientIdCache(BOOTSTRAP_CLIENT_ID);
    url.searchParams.set('client_id', BOOTSTRAP_CLIENT_ID);
    return fetchJsonViaRelay(url.toString());
  }
}

function getClientIdSync() {
  return readClientIdCache() || BOOTSTRAP_CLIENT_ID;
}

function scheduleClientIdRefresh() {
  if (readClientIdCache() && readClientIdCache() !== BOOTSTRAP_CLIENT_ID) return;
  if (clientIdRefreshInflight) return;
  clientIdRefreshInflight = scrapeClientId()
    .then((value) => {
      writeClientIdCache(value);
    })
    .catch(() => {
      writeClientIdCache(BOOTSTRAP_CLIENT_ID);
    })
    .finally(() => {
      clientIdRefreshInflight = undefined;
    });
}

function readClientIdCache() {
  const now = Date.now();
  if (memoryClientId && now - memoryClientId.fetchedAt < CLIENT_ID_TTL_MS) {
    return memoryClientId.value;
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(CLIENT_ID_CACHE_KEY) || '') as ClientIdCache;
    if (parsed?.value && now - parsed.fetchedAt < CLIENT_ID_TTL_MS) {
      memoryClientId = parsed;
      return parsed.value;
    }
  } catch {
    // Ignore broken cache entries.
  }
  return undefined;
}

function writeClientIdCache(value: string) {
  memoryClientId = { value, fetchedAt: Date.now() };
  try {
    localStorage.setItem(CLIENT_ID_CACHE_KEY, JSON.stringify(memoryClientId));
  } catch {
    // Private mode may refuse localStorage writes.
  }
}

function invalidateClientId() {
  memoryClientId = undefined;
  try {
    localStorage.removeItem(CLIENT_ID_CACHE_KEY);
  } catch {
    // ignore
  }
}

async function scrapeClientId() {
  const html = await fetchTextViaRelay(`${SC_ORIGIN}/`);
  const scriptUrls = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map((match) => absolutize(match[1]))
    .filter((url) => url.includes('sndcdn.com') && /\.js(\?|$)/.test(url)
      && !/cookie|analytics|gtm|consent|cmp/i.test(url));

  const unique = [...new Set(scriptUrls)];
  const ordered = [...unique.slice(-8).reverse()];
  for (const scriptUrl of ordered) {
    try {
      const js = await (await fetch(scriptUrl, { signal: AbortSignal.timeout(RELAY_TIMEOUT_MS) })).text();
      const match = js.match(CLIENT_ID_RE);
      const clientId = match?.[1] || match?.[2] || match?.[3];
      if (clientId) return clientId;
    } catch {
      // Keep scanning bundles — hashes change often.
    }
  }
  throw new Error('CLIENT_ID_UNAVAILABLE');
}

async function fetchJsonViaRelay(url: string) {
  const text = await fetchTextViaRelay(url);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('RELAY_BAD_JSON');
  }
}

async function fetchTextViaRelay(url: string) {
  // Race public relays; first valid JSON/body wins.
  // allorigins /raw is the reliable path (~6–12s). /get is kept as a parallel sibling.
  const attempts = [
    fetchAllOriginsRaw(url),
    fetchAllOriginsGet(url),
    fetchCodetabs(url),
  ];

  const errors: string[] = [];
  return new Promise<string>((resolve, reject) => {
    let pending = attempts.length;
    let settled = false;

    attempts.forEach((attempt) => {
      void attempt.then((text) => {
        if (settled) return;
        if (!looksLikeUsefulBody(text)) {
          throw new Error('relay_useless_body');
        }
        settled = true;
        resolve(text);
      }).catch((error) => {
        errors.push(error instanceof Error ? error.message : String(error));
        pending -= 1;
        if (!settled && pending === 0) {
          reject(new Error(`RELAY_FAILED:${errors.join('|')}`));
        }
      });
    });
  });
}

async function fetchAllOriginsRaw(url: string) {
  const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
    headers: { Accept: 'application/json,*/*' },
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`allorigins_raw_http_${response.status}`);
  const text = await response.text();
  if (!text || text.startsWith('Oops...')) throw new Error('allorigins_raw_empty');
  return text;
}

async function fetchAllOriginsGet(url: string) {
  const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`allorigins_http_${response.status}`);
  const wrap = await response.json() as { contents?: string; status?: { http_code?: number } };
  const httpCode = wrap.status?.http_code;
  if (httpCode && httpCode >= 400) throw new Error(`upstream_${httpCode}`);
  if (typeof wrap.contents !== 'string' || !wrap.contents.length) throw new Error('allorigins_empty');
  if (wrap.contents.startsWith('Oops...')) throw new Error('allorigins_timeout');
  return wrap.contents;
}

async function fetchCodetabs(url: string) {
  const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`codetabs_http_${response.status}`);
  const text = await response.text();
  if (!text || text.startsWith('Oops...')) throw new Error('codetabs_empty');
  return text;
}

function looksLikeUsefulBody(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('Oops...')) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  // HTML pages from SoundCloud homepage scrape still count.
  if (trimmed.includes('<script') || trimmed.includes('client_id')) return true;
  return trimmed.length > 40;
}

function mapTrack(raw: any): MappedTrack | undefined {
  if (!raw || (raw.kind && raw.kind !== 'track') || !raw.id || !raw.title) return undefined;
  if (raw.policy === 'BLOCK') return undefined;
  if (!raw.streamable && raw.policy !== 'ALLOW' && raw.policy !== 'SNIP') return undefined;

  const artist = raw.user?.username || raw.user?.full_name || 'SoundCloud';
  const artwork = pickArtwork(raw.artwork_url) || pickArtwork(raw.user?.avatar_url);
  const album = raw.publisher_metadata?.album_title || undefined;
  const genre = raw.genre || undefined;
  const durationMs = Number(raw.duration) || 0;

  return {
    id: `sc:${raw.id}`,
    title: String(raw.title),
    artist: String(artist),
    ...(album ? { album: String(album) } : {}),
    ...(genre ? { genre: String(genre) } : {}),
    durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
    ...(artwork ? { artworkUrl: artwork } : {}),
    audioUrl: `sc://${raw.id}`,
    mimeType: 'audio/mpeg',
    isPreview: raw.policy === 'SNIP',
    playbackCount: Number(raw.playback_count) || 0,
    likesCount: Number(raw.likes_count || raw.favoritings_count) || 0,
  };
}

function mapPlaylistAlbum(raw: any): BygramMusicAlbum | undefined {
  if (!raw || !raw.id || !raw.title) return undefined;
  const artist = raw.user?.username || raw.user?.full_name || 'SoundCloud';
  const artwork = pickArtwork(raw.artwork_url) || pickArtwork(raw.user?.avatar_url);
  const trackCount = Number(raw.track_count || raw.tracks?.length) || 0;
  if (trackCount < 1 && !raw.tracks?.length) return undefined;
  return {
    id: `sc-playlist:${raw.id}`,
    title: String(raw.title),
    artist: String(artist),
    ...(artwork ? { artworkUrl: artwork } : {}),
    trackCount: trackCount || (raw.tracks?.length || 0),
    tracks: Array.isArray(raw.tracks)
      ? rankTracks(raw.tracks.map(mapTrack).filter(Boolean) as MappedTrack[])
      : [],
  };
}

function rankTracks(tracks: MappedTrack[], query = ''): BygramMusicTrack[] {
  const normalizedQuery = normalize(query);
  const wantsRemix = /\b(remix|mix|cover|nightcore|slowed|sped)\b/i.test(query);
  const scored = tracks.map((track) => {
    const title = normalize(track.title);
    const artist = normalize(track.artist);
    const haystack = `${title} ${artist}`;
    let score = (track.likesCount || 0) * 3 + (track.playbackCount || 0);
    if (track.isPreview) score -= 1_000_000;
    if (!wantsRemix && /\b(remix|nightcore|slowed|sped up|8d audio|cover)\b/i.test(track.title)) {
      score -= 500_000;
    }
    if (normalizedQuery) {
      if (title === normalizedQuery || artist === normalizedQuery) score += 2_000_000;
      if (haystack.includes(normalizedQuery)) score += 800_000;
      normalizedQuery.split(/\s+/).filter(Boolean).forEach((token) => {
        if (haystack.includes(token)) score += 50_000;
      });
    }
    return { track, score };
  });

  return scored
    .sort((first, second) => second.score - first.score)
    .map(({ track }) => {
      const {
        isPreview: _isPreview, playbackCount: _pc, likesCount: _lc, ...clean
      } = track;
      return clean;
    })
    .filter((track, index, list) => list.findIndex((item) => item.id === track.id) === index);
}

function dedupeTracks(tracks: BygramMusicTrack[]) {
  return tracks.filter((track, index, list) => list.findIndex((item) => item.id === track.id) === index);
}

function dedupeAlbums(albums: BygramMusicAlbum[]) {
  const seen = new Set<string>();
  return albums.filter((album) => {
    const key = `${normalize(album.artist)}:${normalize(album.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickArtwork(url?: string) {
  if (!url) return undefined;
  return url.replace('-large', '-t500x500').replace('-badge', '-t500x500');
}

function stripScId(value: string) {
  const match = String(value || '').match(/(?:sc:|sc-playlist:|soundcloud:tracks:|soundcloud:playlists:)?(\d{5,})/);
  return match?.[1] || '';
}

function absolutize(url: string) {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SC_ORIGIN}${url}`;
  return url;
}

function normalize(value: string) {
  return String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}
