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
  const variants = searchQueryVariants(query);
  let lastError: Error | undefined;

  for (const variant of variants) {
    try {
      const payload = await scApiGet('/search/tracks', {
        q: variant,
        limit: String(Math.min(Math.max(limit, 24), 50)),
        linked_partitioning: '1',
      });
      const mapped = rankTracks(
        (payload.collection || []).map(mapTrack).filter(Boolean) as MappedTrack[],
        query,
      );
      if (mapped.length) return mapped.slice(0, limit);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function scSearchAlbums(query: string, limit = 12): Promise<BygramMusicAlbum[]> {
  const variant = searchQueryVariants(query)[0] || query;
  const payload = await scApiGet('/search/playlists', {
    q: variant,
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
  // Tracks first — album/playlist search used to compete for the same flaky relays.
  const tracks = await scSearchTracks(query, limit);
  const albums = await scSearchAlbums(query, 12).catch(() => [] as BygramMusicAlbum[]);
  const derived = groupScAlbums(tracks).filter((album) => album.trackCount >= 2).slice(0, 8);
  const mergedAlbums = dedupeAlbums([...albums, ...derived]).slice(0, 16);
  return { tracks, albums: mergedAlbums };
}

export async function scHomeTracks(limit = 20): Promise<{ daily: BygramMusicTrack[]; wave: BygramMusicTrack[] }> {
  const charts = await scApiGet('/charts', {
    kind: 'trending',
    genre: 'soundcloud:genres:all-music',
    limit: String(Math.max(limit * 2, 40)),
    linked_partitioning: '1',
  });
  const ranked = diversifyArtists(rankTracks(
    (charts.collection || [])
      .map((entry: { track?: unknown }) => mapTrack(entry.track || entry))
      .filter(Boolean) as MappedTrack[],
  ), Math.max(limit * 2, 40));

  const daily = ranked.slice(0, limit);
  const dailyIds = new Set(daily.map((track) => track.id));
  // Shifted/reversed pool so "Моя волна" is not a clone of "Плейлист дня".
  const wave = diversifyArtists(
    [...ranked.slice(Math.floor(limit / 2)), ...ranked].filter((track) => !dailyIds.has(track.id)),
    40,
  );

  return {
    daily,
    wave: wave.length >= 8 ? wave : diversifyArtists([...ranked].reverse(), 40),
  };
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
  const html = await fetchTextViaRelay(`${SC_ORIGIN}/`, 'text');
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
  // Relays frequently return HTML error pages with HTTP 200. Require real JSON and retry.
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const text = await fetchTextViaRelay(url, 'json');
      return parseRelayJson(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Brief pause before retry — allorigins often recovers after a burst of HTML pages.
      await new Promise((resolve) => {
        window.setTimeout(resolve, 250 * (attempt + 1));
      });
    }
  }
  throw lastError || new Error('RELAY_BAD_JSON');
}

async function fetchTextViaRelay(url: string, mode: 'json' | 'text' = 'text') {
  // Race public relays; first valid body wins. Jina is preferred for JSON (fast + stable for RU tracks).
  const attempts = mode === 'json'
    ? [fetchJina(url), fetchAllOriginsRaw(url), fetchAllOriginsGet(url), fetchCodetabs(url)]
    : [fetchAllOriginsRaw(url), fetchAllOriginsGet(url), fetchJina(url), fetchCodetabs(url)];

  const errors: string[] = [];
  return new Promise<string>((resolve, reject) => {
    let pending = attempts.length;
    let settled = false;

    attempts.forEach((attempt) => {
      void attempt.then((text) => {
        if (settled) return;
        if (!looksLikeUsefulBody(text, mode)) {
          throw new Error(mode === 'json' ? 'relay_not_json' : 'relay_useless_body');
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

async function fetchJina(url: string) {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: 'application/json',
      'X-Return-Format': 'json',
    },
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`jina_http_${response.status}`);
  const wrap = await response.json() as {
    code?: number;
    data?: { text?: string; content?: string };
  };
  const payload = wrap.data?.content || wrap.data?.text;
  if (typeof payload !== 'string' || !payload.trim()) throw new Error('jina_empty');
  return payload;
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

function parseRelayJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error('RELAY_BAD_JSON');
  }
  const parsed = JSON.parse(trimmed);
  // Jina wraps upstream JSON as a string in data.text / data.content.
  if (parsed?.data && (typeof parsed.data.content === 'string' || typeof parsed.data.text === 'string')) {
    const inner = parsed.data.content || parsed.data.text;
    return JSON.parse(inner);
  }
  return parsed;
}

function looksLikeUsefulBody(text: string, mode: 'json' | 'text') {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('Oops...')) return false;
  if (mode === 'json') {
    // Never accept HTML/error pages for API payloads — that was dropping RU search hits.
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  if (trimmed.includes('<script') || trimmed.includes('client_id')) return true;
  return trimmed.length > 40;
}

function mapTrack(raw: any): MappedTrack | undefined {
  if (!raw || (raw.kind && raw.kind !== 'track') || !raw.id || !raw.title) return undefined;
  if (raw.policy === 'BLOCK') return undefined;
  // MONETIZE is the common policy for popular RU uploads; still streamable via progressive media.
  const policy = String(raw.policy || '');
  if (!raw.streamable && policy !== 'ALLOW' && policy !== 'SNIP' && policy !== 'MONETIZE') {
    return undefined;
  }

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
    isPreview: policy === 'SNIP',
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
  const queryTokens = tokenizeQuery(normalizedQuery);
  const wantsRemix = /\b(remix|mix|cover|nightcore|slowed|sped)\b/i.test(query);
  const scored = tracks.map((track) => {
    const title = normalize(track.title);
    const artist = normalize(track.artist);
    const haystack = `${title} ${artist}`.replace(/[-_/|]+/g, ' ');
    const compactHaystack = haystack.replace(/\s+/g, '');
    let score = (track.likesCount || 0) * 3 + (track.playbackCount || 0);
    if (track.isPreview) score -= 1_000_000;
    if (!wantsRemix && /\b(remix|nightcore|slowed|sped up|8d audio|cover)\b/i.test(track.title)) {
      score -= 500_000;
    }
    if (normalizedQuery) {
      const compactQuery = normalizedQuery.replace(/[^a-z0-9а-яё]+/gi, '');
      if (title === normalizedQuery || artist === normalizedQuery) score += 2_000_000;
      if (haystack.includes(normalizedQuery) || compactHaystack.includes(compactQuery)) score += 800_000;
      queryTokens.forEach((token) => {
        if (haystack.includes(token) || compactHaystack.includes(token)) score += 50_000;
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

function searchQueryVariants(query: string) {
  const raw = String(query || '').trim();
  const cleaned = raw
    .replace(/[–—−]/g, ' ')
    .replace(/[-_/|,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const noPunctuation = cleaned.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(new Set([raw, cleaned, noPunctuation].filter(Boolean)));
}

function tokenizeQuery(value: string) {
  return value
    .replace(/[–—−_-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function dedupeTracks(tracks: BygramMusicTrack[]) {
  return tracks.filter((track, index, list) => list.findIndex((item) => item.id === track.id) === index);
}

function diversifyArtists(tracks: BygramMusicTrack[], limit: number) {
  const selected: BygramMusicTrack[] = [];
  const artistCounts = new Map<string, number>();
  let lastArtist = '';

  const tryPush = (track: BygramMusicTrack, enforceSpacing: boolean, artistLimit: number) => {
    const artistKey = normalize(track.artist) || track.id;
    if (selected.some((item) => item.id === track.id)) return false;
    if (enforceSpacing && artistKey === lastArtist) return false;
    if ((artistCounts.get(artistKey) || 0) >= artistLimit) return false;
    selected.push(track);
    artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1);
    lastArtist = artistKey;
    return true;
  };

  tracks.forEach((track) => {
    if (selected.length >= limit) return;
    tryPush(track, true, 2);
  });
  tracks.forEach((track) => {
    if (selected.length >= limit) return;
    tryPush(track, false, 3);
  });
  return selected.slice(0, limit);
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
