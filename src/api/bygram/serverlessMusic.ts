import { getGlobal } from '../../global';

import type {
  BygramMusicAlbum,
  BygramMusicHome,
  BygramMusicPlay,
  BygramMusicPlaylist,
  BygramMusicSearch,
  BygramMusicTrack,
} from './musicTypes';

import {
  groupScAlbums,
  scHomeTracks,
  scPlaylistTracks,
  scRelatedTracks,
  scResolveStream,
  scSearch,
  scTracksByIds,
} from './soundcloudBrowser';

type StoredPlaylist = Pick<BygramMusicPlaylist, 'id' | 'name' | 'trackIds' | 'createdAt' | 'updatedAt'>;
type MusicState = {
  likedIds: string[];
  recentIds: string[];
  playlists: StoredPlaylist[];
  playCounts: Record<string, number>;
};

const STATE_KEY = 'bygram-serverless-music-v1';
const TRACK_CACHE_KEY = 'bygram-sc-track-cache-v1';
const HOME_CACHE_KEY = 'bygram-sc-home-cache-v1';
const SEARCH_CACHE_KEY = 'bygram-sc-search-cache-v1';
const SEARCH_CACHE_TTL_MS = 20 * 60 * 1000;
const CATALOG_PATH = 'bygram-music/catalog.json';
const MAX_RECENT = 40;
const MAX_TRACK_CACHE = 500;
const MAX_SEARCH_CACHE = 40;
let catalogPromise: Promise<BygramMusicTrack[]> | undefined;
let homeInflight: Promise<BygramMusicHome> | undefined;

type HomeCache = {
  fetchedAt: number;
  daily: BygramMusicTrack[];
  wave: BygramMusicTrack[];
};

class BygramServerlessMusic {
  ensureSession() {
    return Promise.resolve(undefined);
  }

  rememberMusicTrack(track: BygramMusicTrack) {
    cacheTracks([track]);
  }

  /** Instant paint from local cache — never waits on bygramMusic relays. */
  getCachedMusicHome(): BygramMusicHome | undefined {
    const state = loadState();
    const cached = readHomeCache();
    const favorites = resolveTracksSync(state.likedIds);
    const recent = resolveTracksSync(state.recentIds);
    const playlists = state.playlists.map((playlist) => hydratePlaylistSync(playlist));

    if (!cached?.daily.length && !favorites.length && !recent.length && !playlists.length) {
      return undefined;
    }

    return {
      daily: cached?.daily || [],
      wave: cached?.wave.length ? cached.wave : (cached?.daily || []),
      recent,
      favorites,
      playlists,
      librarySize: cached?.daily.length || favorites.length || recent.length,
    };
  }

  async getMusicHome(): Promise<BygramMusicHome> {
    if (homeInflight) return homeInflight;

    homeInflight = (async () => {
      const state = loadState();
      const cached = readHomeCache();
      const catalogPromiseLocal = loadCatalog().catch(() => [] as BygramMusicTrack[]);

      // Soft deadline: keep showing cache/catalog instead of blocking on slow relays.
      const remote = await Promise.race([
        scHomeTracks().catch(() => undefined),
        new Promise<undefined>((resolve) => {
          window.setTimeout(() => resolve(undefined), cached?.daily.length ? 900 : 2500);
        }),
      ]);

      // If Soft deadline missed, still let charts finish in the background for next open.
      if (!remote?.daily?.length) {
        void scHomeTracks()
          .then((fresh) => {
            if (fresh?.daily?.length) {
              writeHomeCache({ daily: fresh.daily, wave: fresh.wave || fresh.daily });
              cacheTracks([...fresh.daily, ...(fresh.wave || [])]);
            }
          })
          .catch(() => undefined);
      }

      const catalog = remote?.daily?.length
        ? []
        : (cached?.daily.length ? [] : await catalogPromiseLocal);

      const daily = remote?.daily?.length
        ? remote.daily
        : (cached?.daily.length
          ? cached.daily
          : deterministicOrder(catalog, getDateSeed()).slice(0, 20));
      cacheTracks(daily);
      if (remote?.daily?.length) {
        writeHomeCache({ daily: remote.daily, wave: remote.wave || remote.daily });
      }

      const favorites = await resolveTracks(state.likedIds);
      const recent = await resolveTracks(state.recentIds);
      cacheTracks([...favorites, ...recent]);

      let wave = remote?.wave?.length
        ? remote.wave
        : (cached?.wave.length
          ? cached.wave
          : buildWave(catalog.length ? catalog : daily, favorites, recent, state.playCounts).slice(0, 40));

      // Personalize wave with related tracks when the user already has listening history.
      const waveSeed = favorites[0] || recent[0];
      if (waveSeed && isBygramMusicRemoteId(waveSeed.id)) {
        const related = await Promise.race([
          scRelatedTracks(waveSeed.id, 40).catch(() => undefined),
          new Promise<undefined>((resolve) => {
            window.setTimeout(() => resolve(undefined), 1800);
          }),
        ]);
        if (related?.length) {
          wave = buildWave(
            related,
            favorites,
            recent,
            state.playCounts,
            daily.map((track) => track.id),
          ).slice(0, 40);
        }
      }

      cacheTracks(wave);
      if (remote?.daily?.length || wave.length) {
        writeHomeCache({ daily, wave });
      }

      return {
        daily,
        wave,
        recent,
        favorites,
        playlists: await Promise.all(state.playlists.map((playlist) => hydratePlaylist(playlist))),
        librarySize: daily.length || catalog.length,
      };
    })().finally(() => {
      homeInflight = undefined;
    });

    return homeInflight;
  }

  getCachedMusicSearch(query: string): BygramMusicSearch | undefined {
    return readSearchCache(normalize(query));
  }

  async searchMusic(query: string): Promise<BygramMusicSearch> {
    const trimmed = query.trim();
    const normalized = normalize(trimmed);
    if (!normalized) return { tracks: [], albums: [] };

    const cached = readSearchCache(normalized);
    if (cached?.tracks.length) {
      if (!isSearchCacheFresh(normalized)) {
        void refreshSearchCache(trimmed, normalized);
      }
      return cached;
    }

    let remote: BygramMusicSearch | undefined;
    let remoteFailed = false;
    try {
      remote = await scSearch(trimmed, 40);
    } catch {
      remoteFailed = true;
    }

    if (remote?.tracks.length) {
      cacheTracks(remote.tracks);
      remote.albums.forEach((album) => cacheTracks(album.tracks));
      writeSearchCache(normalized, remote);
      return remote;
    }

    const tracks = await loadCatalog().catch(() => [] as BygramMusicTrack[]);
    const found = tracks.filter((track) => normalize(
      `${track.title} ${track.artist} ${track.album || ''} ${track.genre || ''}`,
    ).includes(normalized));
    if (found.length) {
      return { tracks: found.slice(0, 40), albums: groupAlbums(found).slice(0, 20) };
    }

    // Don't pretend "nothing found" when bygramMusic relays failed — UI should retry.
    if (remoteFailed) throw new Error('SEARCH_UNAVAILABLE');
    return { tracks: [], albums: [] };
  }

  async getMusicAlbum(albumId: string) {
    if (albumId.startsWith('sc-playlist:')) {
      const remote = await scPlaylistTracks(albumId).catch(() => undefined);
      if (remote) {
        cacheTracks(remote.tracks);
        return remote;
      }
    }
    if (albumId.startsWith('sc-album:')) {
      return groupScAlbums(Object.values(loadTrackCache())).find(({ id }) => id === albumId);
    }
    return groupAlbums(await loadCatalog()).find(({ id }) => id === albumId);
  }

  setMusicLiked(trackId: string, liked: boolean) {
    const state = loadState();
    state.likedIds = liked
      ? Array.from(new Set([trackId, ...state.likedIds]))
      : state.likedIds.filter((id) => id !== trackId);
    saveState(state);
    return Promise.resolve({ liked });
  }

  async getMusicTrackWave(trackId: string) {
    if (isBygramMusicRemoteId(trackId)) {
      const remote = await scRelatedTracks(trackId, 40).catch(() => undefined);
      if (remote?.length) {
        cacheTracks(remote);
        return remote.slice(0, 40);
      }
    }

    const tracks = await loadCatalog().catch(() => [] as BygramMusicTrack[]);
    const source = (await resolveTracks([trackId]))[0] || tracks.find(({ id }) => id === trackId);
    if (!source) return [];
    const pool = tracks.length ? tracks : Object.values(loadTrackCache());
    return [source, ...pool.filter(({ id }) => id !== trackId).sort((first, second) => (
      similarity(second, source) - similarity(first, source)
    ))].slice(0, 40);
  }

  async createMusicPlaylist(name: string) {
    const state = loadState();
    const now = new Date().toISOString();
    const playlist: StoredPlaylist = {
      id: crypto.randomUUID(), name, trackIds: [], createdAt: now, updatedAt: now,
    };
    state.playlists.unshift(playlist);
    saveState(state);
    return this.getPlaylist(playlist.id);
  }

  async updateMusicPlaylist(playlistId: string, trackId: string, shouldAdd: boolean) {
    const state = loadState();
    const playlist = state.playlists.find(({ id }) => id === playlistId);
    if (!playlist) throw new Error('PLAYLIST_NOT_FOUND');
    playlist.trackIds = shouldAdd
      ? Array.from(new Set([...playlist.trackIds, trackId]))
      : playlist.trackIds.filter((id) => id !== trackId);
    playlist.updatedAt = new Date().toISOString();
    saveState(state);
    return this.getPlaylist(playlistId);
  }

  async shareMusicPlaylist(playlistId: string) {
    const playlist = await this.getPlaylist(playlistId);
    return { ...playlist, shareCode: encodeShareCode(playlist) };
  }

  async getSharedMusicPlaylist(shareCode: string) {
    const shared = decodeShareCode(shareCode);
    const tracks = await resolveTracks(shared.trackIds);
    return {
      ...shared,
      tracks,
      shareCode,
      isOwn: false,
      ownerTelegramUserId: '',
      type: 'custom' as const,
    } satisfies BygramMusicPlaylist;
  }

  async saveSharedMusicPlaylist(shareCode: string) {
    const shared = await this.getSharedMusicPlaylist(shareCode);
    const state = loadState();
    const now = new Date().toISOString();
    const playlist: StoredPlaylist = {
      id: crypto.randomUUID(),
      name: shared.name,
      trackIds: shared.trackIds,
      createdAt: now,
      updatedAt: now,
    };
    state.playlists.unshift(playlist);
    saveState(state);
    cacheTracks(shared.tracks);
    return this.getPlaylist(playlist.id);
  }

  async startMusicPlay(trackId: string): Promise<BygramMusicPlay> {
    rememberPlayed(trackId);

    if (isBygramMusicRemoteId(trackId)) {
      const play = await scResolveStream(trackId);
      cacheTracks([play.track]);
      return {
        id: crypto.randomUUID(),
        track: play.track,
        streamUrl: play.streamUrl,
      };
    }

    const track = (await resolveTracks([trackId]))[0]
      || (await loadCatalog()).find(({ id }) => id === trackId);
    if (!track) throw new Error('TRACK_NOT_FOUND');
    return { id: crypto.randomUUID(), track, streamUrl: resolveAssetUrl(track.audioUrl) };
  }

  updateMusicPlay() {
    return Promise.resolve({ ok: true as const });
  }

  getMusicAudioUrl(streamUrl: string) {
    return streamUrl;
  }

  async downloadMusicTrack(track: BygramMusicTrack) {
    let url = resolveAssetUrl(track.audioUrl);
    let mimeType = track.mimeType || 'audio/mpeg';
    if (isBygramMusicRemoteId(track.id)) {
      const play = await scResolveStream(track.id);
      url = play.streamUrl;
      mimeType = play.mimeType || mimeType;
      cacheTracks([play.track]);
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('TRACK_DOWNLOAD_FAILED');
    const blob = await response.blob();
    mimeType = blob.type || mimeType;
    const extension = mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'm4a';
    return new File([blob], `${safeFileName(track.artist)} - ${safeFileName(track.title)}.${extension}`, {
      type: mimeType,
    });
  }

  async downloadMusicPlaylist(playlist: BygramMusicPlaylist, limit = 20) {
    const tracks = playlist.tracks.slice(0, limit);
    const files: File[] = [];
    for (const track of tracks) {
      try {
        files.push(await this.downloadMusicTrack(track));
      } catch {
        // Skip tracks that fail to download; send whatever we could prepare.
      }
    }
    if (!files.length) throw new Error('PLAYLIST_DOWNLOAD_FAILED');
    return files;
  }

  async resolveMusicPlaylistPayload(name: string, trackIds: string[]) {
    const tracks = await resolveTracks(trackIds);
    cacheTracks(tracks);
    const now = new Date().toISOString();
    return {
      id: `byproto-${hash(trackIds.join(','))}`,
      name,
      trackIds: tracks.map((track) => track.id),
      tracks,
      createdAt: now,
      updatedAt: now,
      isOwn: false,
      ownerTelegramUserId: '',
      type: 'custom' as const,
    } satisfies BygramMusicPlaylist;
  }

  async importMusicPlaylist(name: string, trackIds: string[]) {
    const tracks = await resolveTracks(trackIds);
    cacheTracks(tracks);
    let playlist = await this.createMusicPlaylist(name.slice(0, 80) || 'Плейлист bygramMusic');
    for (const track of tracks) {
      playlist = await this.updateMusicPlaylist(playlist.id, track.id, true);
    }
    return playlist;
  }

  private async getPlaylist(id: string) {
    const playlist = loadState().playlists.find((item) => item.id === id);
    if (!playlist) throw new Error('PLAYLIST_NOT_FOUND');
    return hydratePlaylist(playlist);
  }
}

function loadCatalog() {
  catalogPromise ||= fetch(resolveAssetUrl(CATALOG_PATH)).then(async (response) => {
    if (!response.ok) throw new Error('MUSIC_CATALOG_UNAVAILABLE');
    return response.json() as Promise<BygramMusicTrack[]>;
  });
  return catalogPromise;
}

async function resolveTracks(ids: string[]) {
  if (!ids.length) return [] as BygramMusicTrack[];

  const cache = loadTrackCache();
  const missing: string[] = [];
  ids.forEach((id) => {
    if (!cache[id]) missing.push(id);
  });

  if (missing.length) {
    const scMissing = missing.filter(isBygramMusicRemoteId);
    if (scMissing.length) {
      try {
        cacheTracks(await scTracksByIds(scMissing));
      } catch {
        // Fall through to local catalog for anything still missing.
      }
    }

    const refreshed = loadTrackCache();
    const stillMissing = missing.filter((id) => !refreshed[id] && !isBygramMusicRemoteId(id));
    if (stillMissing.length) {
      try {
        const catalog = await loadCatalog();
        const byId = new Map(catalog.map((track) => [track.id, track]));
        cacheTracks(stillMissing.map((id) => byId.get(id)).filter(Boolean));
      } catch {
        // Local catalog is optional when bygramMusic is available.
      }
    }
  }

  const finalCache = loadTrackCache();
  return ids.map((id) => finalCache[id]).filter(Boolean);
}

async function hydratePlaylist(playlist: StoredPlaylist): Promise<BygramMusicPlaylist> {
  const tracks = await resolveTracks(playlist.trackIds);
  return {
    ...playlist,
    type: 'custom',
    ownerTelegramUserId: getGlobal().currentUserId || '',
    trackIds: [...playlist.trackIds],
    tracks,
    isOwn: true,
  };
}

function loadState(): MusicState {
  try {
    const accountId = getGlobal().currentUserId || 'local';
    const all = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') as Record<string, MusicState>;
    return all[accountId] || { likedIds: [], recentIds: [], playlists: [], playCounts: {} };
  } catch {
    return { likedIds: [], recentIds: [], playlists: [], playCounts: {} };
  }
}

function saveState(state: MusicState) {
  const accountId = getGlobal().currentUserId || 'local';
  let all: Record<string, MusicState> = {};
  try {
    all = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') as Record<string, MusicState>;
  } catch {
    // Replace invalid local data with a valid account store.
  }
  all[accountId] = state;
  localStorage.setItem(STATE_KEY, JSON.stringify(all));
}

function loadTrackCache(): Record<string, BygramMusicTrack> {
  try {
    return JSON.parse(localStorage.getItem(TRACK_CACHE_KEY) || '{}') as Record<string, BygramMusicTrack>;
  } catch {
    return {};
  }
}

function cacheTracks(tracks: BygramMusicTrack[]) {
  if (!tracks.length) return;
  const cache = loadTrackCache();
  tracks.forEach((track) => {
    if (track?.id) cache[track.id] = track;
  });
  const ids = Object.keys(cache);
  if (ids.length > MAX_TRACK_CACHE) {
    ids.slice(0, ids.length - MAX_TRACK_CACHE).forEach((id) => {
      delete cache[id];
    });
  }
  localStorage.setItem(TRACK_CACHE_KEY, JSON.stringify(cache));
}

function resolveTracksSync(ids: string[]) {
  const cache = loadTrackCache();
  return ids.map((id) => cache[id]).filter(Boolean);
}

function hydratePlaylistSync(playlist: StoredPlaylist): BygramMusicPlaylist {
  const tracks = resolveTracksSync(playlist.trackIds);
  return {
    ...playlist,
    type: 'custom',
    ownerTelegramUserId: getGlobal().currentUserId || '',
    trackIds: [...playlist.trackIds],
    tracks,
    isOwn: true,
  };
}

function readHomeCache(): HomeCache | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || '') as HomeCache;
    if (!parsed?.daily?.length) return undefined;
    return parsed; // stale-while-revalidate: always paint, refresh in background
  } catch {
    return undefined;
  }
}

function writeHomeCache(value: Omit<HomeCache, 'fetchedAt'>) {
  try {
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({
      fetchedAt: Date.now(),
      daily: value.daily,
      wave: value.wave,
    } satisfies HomeCache));
  } catch {
    // ignore quota / private mode
  }
}

type SearchCacheStore = Record<string, { fetchedAt: number; result: BygramMusicSearch }>;

function readSearchCache(normalizedQuery: string): BygramMusicSearch | undefined {
  if (!normalizedQuery) return undefined;
  try {
    const store = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}') as SearchCacheStore;
    const entry = store[normalizedQuery];
    if (!entry?.result?.tracks?.length) return undefined;
    return entry.result;
  } catch {
    return undefined;
  }
}

function isSearchCacheFresh(normalizedQuery: string) {
  try {
    const store = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}') as SearchCacheStore;
    const entry = store[normalizedQuery];
    return Boolean(entry && Date.now() - entry.fetchedAt < SEARCH_CACHE_TTL_MS);
  } catch {
    return false;
  }
}

function writeSearchCache(normalizedQuery: string, result: BygramMusicSearch) {
  if (!normalizedQuery || !result.tracks.length) return;
  try {
    const store = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}') as SearchCacheStore;
    store[normalizedQuery] = { fetchedAt: Date.now(), result };
    const keys = Object.keys(store);
    if (keys.length > MAX_SEARCH_CACHE) {
      keys
        .sort((first, second) => (store[first].fetchedAt || 0) - (store[second].fetchedAt || 0))
        .slice(0, keys.length - MAX_SEARCH_CACHE)
        .forEach((key) => {
          delete store[key];
        });
    }
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

async function refreshSearchCache(query: string, normalizedQuery: string) {
  const remote = await scSearch(query, 40).catch(() => undefined);
  if (!remote?.tracks.length) return;
  cacheTracks(remote.tracks);
  remote.albums.forEach((album) => cacheTracks(album.tracks));
  writeSearchCache(normalizedQuery, remote);
}

function rememberPlayed(trackId: string) {
  const state = loadState();
  state.recentIds = [trackId, ...state.recentIds.filter((id) => id !== trackId)].slice(0, MAX_RECENT);
  state.playCounts[trackId] = (state.playCounts[trackId] || 0) + 1;
  saveState(state);
}

function groupAlbums(tracks: BygramMusicTrack[]) {
  const groups = new Map<string, BygramMusicTrack[]>();
  tracks.forEach((track) => {
    const title = track.album || 'Без альбома';
    const key = `${normalize(track.artist)}:${normalize(title)}`;
    groups.set(key, [...(groups.get(key) || []), track]);
  });
  return Array.from(groups, ([id, albumTracks]): BygramMusicAlbum => ({
    id,
    title: albumTracks[0].album || 'Без альбома',
    artist: albumTracks[0].artist,
    artworkUrl: albumTracks.find(({ artworkUrl }) => artworkUrl)?.artworkUrl,
    trackCount: albumTracks.length,
    tracks: albumTracks,
  }));
}

function buildWave(
  tracks: BygramMusicTrack[],
  favorites: BygramMusicTrack[],
  recent: BygramMusicTrack[],
  counts: Record<string, number>,
  excludedIds: string[] = [],
) {
  const excluded = new Set(excludedIds);
  const seeds = [...favorites, ...recent].slice(0, 12);
  const pool = tracks.filter((track) => !excluded.has(track.id));
  const ordered = !seeds.length
    ? deterministicOrder(pool, getDateSeed() + 17)
    : [...pool].sort((first, second) => {
      const firstScore = seeds.reduce((score, seed) => score + similarity(first, seed), 0)
        + (counts[first.id] || 0) * 5;
      const secondScore = seeds.reduce((score, seed) => score + similarity(second, seed), 0)
        + (counts[second.id] || 0) * 5;
      return secondScore - firstScore;
    });

  const selected: BygramMusicTrack[] = [];
  const artistCounts = new Map<string, number>();
  let lastArtist = '';
  ordered.forEach((track) => {
    if (selected.length >= 40) return;
    const artistKey = normalize(track.artist) || track.id;
    if (artistKey === lastArtist) return;
    if ((artistCounts.get(artistKey) || 0) >= 2) return;
    selected.push(track);
    artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1);
    lastArtist = artistKey;
  });
  if (selected.length < 12) {
    ordered.forEach((track) => {
      if (selected.length >= 40 || selected.some((item) => item.id === track.id)) return;
      selected.push(track);
    });
  }
  return selected;
}

function similarity(first: BygramMusicTrack, second: BygramMusicTrack) {
  return Number(normalize(first.artist) === normalize(second.artist)) * 4
    + Number(Boolean(first.album) && normalize(first.album || '') === normalize(second.album || '')) * 2
    + Number(Boolean(first.genre) && normalize(first.genre || '') === normalize(second.genre || ''));
}

function deterministicOrder(tracks: BygramMusicTrack[], seed: number) {
  return [...tracks].sort((first, second) => hash(`${first.id}:${seed}`) - hash(`${second.id}:${seed}`));
}

function getDateSeed() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return Number(`${now.getFullYear()}${month}${day}`);
}

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, ' ')
    .replace(/[-_/|,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:')) return path;
  return new URL(path, document.baseURI).toString();
}

function isBygramMusicRemoteId(id: string) {
  return id.startsWith('sc:') || /^\d{5,}$/.test(id);
}

function encodeShareCode(playlist: BygramMusicPlaylist) {
  const payload = JSON.stringify({
    name: playlist.name,
    trackIds: playlist.trackIds,
    tracks: playlist.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      durationSeconds: track.durationSeconds,
      artworkUrl: track.artworkUrl,
      audioUrl: track.audioUrl,
      mimeType: track.mimeType,
    })),
  });
  return btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShareCode(code: string) {
  const normalized = code.replace(/-/g, '+').replace(/_/g, '/');
  const payload = decodeURIComponent(escape(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))));
  const parsed = JSON.parse(payload) as {
    name: string;
    trackIds: string[];
    tracks?: BygramMusicTrack[];
  };
  if (!parsed.name || !Array.isArray(parsed.trackIds)) throw new Error('INVALID_PLAYLIST');
  if (parsed.tracks?.length) cacheTracks(parsed.tracks);
  const now = new Date().toISOString();
  return {
    id: `shared-${hash(payload)}`,
    name: parsed.name,
    trackIds: parsed.trackIds,
    createdAt: now,
    updatedAt: now,
  };
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

export const bygramMusicApi = new BygramServerlessMusic();
