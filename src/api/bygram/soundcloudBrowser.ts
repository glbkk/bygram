import type { BygramMusicAlbum, BygramMusicTrack } from './musicTypes';

const SC_ORIGIN = 'https://soundcloud.com';
const SC_API = 'https://api-v2.soundcloud.com';
const CLIENT_ID_CACHE_KEY = 'bygram-sc-client-id-v1';
const CLIENT_ID_TTL_MS = 6 * 60 * 60 * 1000;
// Public web-app client_id embedded in SoundCloud's own frontend bundles — not a user/app secret.
const BOOTSTRAP_CLIENT_ID = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
const CLIENT_ID_RE = new RegExp([
  String.raw`client_id\s*[:=]\s*["']([0-9a-zA-Z]{32})["']`,
  String.raw`"client_id"\s*:\s*"([0-9a-zA-Z]{32})"`,
  String.raw`clientId["']?\s*[:=]\s*["']([0-9a-zA-Z]{32})["']`,
].join('|'));

type ClientIdCache = { value: string; fetchedAt: number };
type MappedTrack = BygramMusicTrack & { isPreview?: boolean };

let memoryClientId: ClientIdCache | undefined;
let clientIdInflight: Promise<string> | undefined;

/**
 * SoundCloud for a static open-source PWA: no registrations, no API keys, no hosted backends.
 * api-v2 blocks browser CORS, so metadata goes through public read-only relays.
 * Progressive MP3 URLs from sndcdn already allow cross-origin audio playback.
 */
export async function scSearchTracks(query: string, limit = 40): Promise<BygramMusicTrack[]> {
  const payload = await scApiGet('/search/tracks', {
    q: query,
    limit: String(limit),
    linked_partitioning: '1',
  });
  return preferPlayable((payload.collection || []).map(mapTrack).filter(Boolean));
}

export async function scHomeTracks(limit = 24): Promise<{ daily: BygramMusicTrack[]; wave: BygramMusicTrack[] }> {
  const charts = await scApiGet('/charts', {
    kind: 'trending',
    genre: 'soundcloud:genres:all-music',
    limit: String(limit),
    linked_partitioning: '1',
  });
  const daily = preferPlayable(
    (charts.collection || [])
      .map((entry: { track?: unknown }) => mapTrack(entry.track || entry))
      .filter(Boolean),
  ).slice(0, 20);

  let wave = daily;
  if (daily[0]) {
    try {
      wave = await scRelatedTracks(daily[0].id, 40);
    } catch {
      // Trending alone is enough for first paint.
    }
  }
  return { daily, wave };
}

export async function scRelatedTracks(trackId: string, limit = 40): Promise<BygramMusicTrack[]> {
  const numericId = stripScId(trackId);
  const [seedRaw, related] = await Promise.all([
    scApiGet(`/tracks/${numericId}`),
    scApiGet(`/tracks/${numericId}/related`, {
      limit: String(limit),
      linked_partitioning: '1',
    }),
  ]);
  const list = [mapTrack(seedRaw), ...(related.collection || []).map(mapTrack)].filter(Boolean);
  return dedupeTracks(preferPlayable(list)).slice(0, limit);
}

export async function scTracksByIds(ids: string[]): Promise<BygramMusicTrack[]> {
  const numeric = Array.from(new Set(ids.map(stripScId).filter(Boolean))).slice(0, 40);
  if (!numeric.length) return [];
  const payload = await scApiGet('/tracks', { ids: numeric.join(',') });
  const list = Array.isArray(payload) ? payload : (payload.collection || []);
  return preferPlayable(list.map(mapTrack).filter(Boolean));
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

  const clientId = await getClientId();
  const resolveUrl = new URL(progressive.url);
  resolveUrl.searchParams.set('client_id', clientId);
  if (raw.track_authorization) {
    resolveUrl.searchParams.set('track_authorization', raw.track_authorization);
  }

  const resolved = await fetchJsonViaRelay(resolveUrl.toString());
  if (!resolved?.url) throw new Error('STREAM_UNAVAILABLE');
  const { isPreview: _isPreview, ...cleanTrack } = track;
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
  const clientId = await getClientId();
  const url = new URL(`${SC_API}${pathname}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('client_id', clientId);

  try {
    return await fetchJsonViaRelay(url.toString());
  } catch {
    invalidateClientId();
    const freshId = await getClientId(true);
    url.searchParams.set('client_id', freshId);
    return fetchJsonViaRelay(url.toString());
  }
}

async function getClientId(force = false) {
  if (!force) {
    const cached = readClientIdCache();
    if (cached) return cached;
  }
  if (clientIdInflight) return clientIdInflight;

  clientIdInflight = scrapeClientId()
    .catch(() => BOOTSTRAP_CLIENT_ID)
    .then((value) => {
      writeClientIdCache(value);
      return value;
    })
    .finally(() => {
      clientIdInflight = undefined;
    });

  return clientIdInflight;
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
  const ordered = [...unique.slice(-12).reverse(), ...unique.slice(0, 8)];
  for (const scriptUrl of ordered) {
    try {
      // a-v2.sndcdn.com already allows browser CORS.
      const js = await (await fetch(scriptUrl)).text();
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
  const errors: string[] = [];
  const timeoutMs = 12_000;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`allorigins_http_${response.status}`);
      const wrap = await response.json() as { contents?: string; status?: { http_code?: number } };
      const httpCode = wrap.status?.http_code;
      if (httpCode && httpCode >= 400) throw new Error(`upstream_${httpCode}`);
      if (typeof wrap.contents !== 'string' || !wrap.contents.length) {
        throw new Error('allorigins_empty');
      }
      if (wrap.contents.startsWith('Oops...')) throw new Error('allorigins_timeout');
      return wrap.contents;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`codetabs_http_${response.status}`);
    const text = await response.text();
    if (!text || text.startsWith('Oops...')) throw new Error('codetabs_empty');
    return text;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`RELAY_FAILED:${errors.join('|')}`);
}

function mapTrack(raw: any): MappedTrack | undefined {
  if (!raw || (raw.kind && raw.kind !== 'track') || !raw.id || !raw.title) return undefined;
  if (raw.policy === 'BLOCK') return undefined;
  if (!raw.streamable && raw.policy !== 'ALLOW') return undefined;

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
  };
}

function preferPlayable(tracks: Array<MappedTrack | undefined>): BygramMusicTrack[] {
  const present = tracks.filter((track): track is MappedTrack => Boolean(track));
  return present
    .sort((first, second) => Number(Boolean(first.isPreview)) - Number(Boolean(second.isPreview)))
    .map(({ isPreview: _isPreview, ...track }) => track);
}

function dedupeTracks(tracks: BygramMusicTrack[]) {
  return tracks.filter((track, index, list) => list.findIndex((item) => item.id === track.id) === index);
}

function pickArtwork(url?: string) {
  if (!url) return undefined;
  return url.replace('-large', '-t500x500').replace('-badge', '-t500x500');
}

function stripScId(value: string) {
  const match = String(value || '').match(/(?:sc:|soundcloud:tracks:)?(\d{5,})/);
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
