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
  scRelatedTracks,
  scResolveStream,
  scSearchTracks,
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
const CATALOG_PATH = 'bygram-music/catalog.json';
const MAX_RECENT = 40;
const MAX_TRACK_CACHE = 500;
let catalogPromise: Promise<BygramMusicTrack[]> | undefined;

class BygramServerlessMusic {
  ensureSession() {
    return Promise.resolve(undefined);
  }

  async getMusicHome(): Promise<BygramMusicHome> {
    const state = loadState();
    const remote = await scHomeTracks().catch(() => undefined);
    const catalog = remote ? [] : await loadCatalog().catch(() => [] as BygramMusicTrack[]);
    const daily = remote?.daily?.length ? remote.daily : deterministicOrder(catalog, getDateSeed()).slice(0, 20);
    cacheTracks(daily);

    const favorites = await resolveTracks(state.likedIds);
    const recent = await resolveTracks(state.recentIds);
    cacheTracks([...favorites, ...recent]);

    const wave = remote?.wave?.length
      ? remote.wave
      : buildWave(catalog.length ? catalog : daily, favorites, recent, state.playCounts).slice(0, 40);
    cacheTracks(wave);

    return {
      daily,
      wave,
      recent,
      favorites,
      playlists: await Promise.all(state.playlists.map((playlist) => hydratePlaylist(playlist))),
      librarySize: remote?.daily.length || catalog.length || daily.length,
    };
  }

  async searchMusic(query: string): Promise<BygramMusicSearch> {
    const normalized = normalize(query);
    if (!normalized) return { tracks: [], albums: [] };

    const remoteTracks = await scSearchTracks(query.trim(), 40).catch(() => undefined);
    if (remoteTracks?.length) {
      cacheTracks(remoteTracks);
      return {
        tracks: remoteTracks.slice(0, 40),
        albums: groupScAlbums(remoteTracks).slice(0, 20),
      };
    }

    const tracks = await loadCatalog().catch(() => [] as BygramMusicTrack[]);
    const found = tracks.filter((track) => normalize(
      `${track.title} ${track.artist} ${track.album || ''} ${track.genre || ''}`,
    ).includes(normalized));
    return { tracks: found.slice(0, 40), albums: groupAlbums(found).slice(0, 20) };
  }

  async getMusicAlbum(albumId: string) {
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
    if (isSoundCloudId(trackId)) {
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

    if (isSoundCloudId(trackId)) {
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
    if (isSoundCloudId(track.id)) {
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
    const scMissing = missing.filter(isSoundCloudId);
    if (scMissing.length) {
      try {
        cacheTracks(await scTracksByIds(scMissing));
      } catch {
        // Fall through to local catalog for anything still missing.
      }
    }

    const refreshed = loadTrackCache();
    const stillMissing = missing.filter((id) => !refreshed[id] && !isSoundCloudId(id));
    if (stillMissing.length) {
      try {
        const catalog = await loadCatalog();
        const byId = new Map(catalog.map((track) => [track.id, track]));
        cacheTracks(stillMissing.map((id) => byId.get(id)).filter(Boolean));
      } catch {
        // Local catalog is optional when SoundCloud is available.
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
  tracks: BygramMusicTrack[], favorites: BygramMusicTrack[], recent: BygramMusicTrack[], counts: Record<string, number>,
) {
  const seeds = [...favorites, ...recent].slice(0, 12);
  if (!seeds.length) return deterministicOrder(tracks, getDateSeed() + 17);
  return [...tracks].sort((first, second) => {
    const firstScore = seeds.reduce((score, seed) => score + similarity(first, seed), 0) + (counts[first.id] || 0);
    const secondScore = seeds.reduce((score, seed) => score + similarity(second, seed), 0) + (counts[second.id] || 0);
    return secondScore - firstScore;
  });
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
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}

function resolveAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:')) return path;
  return new URL(path, document.baseURI).toString();
}

function isSoundCloudId(id: string) {
  return id.startsWith('sc:') || /^\d{5,}$/.test(id);
}

function encodeShareCode(playlist: BygramMusicPlaylist) {
  const payload = JSON.stringify({ name: playlist.name, trackIds: playlist.trackIds });
  return btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShareCode(code: string) {
  const normalized = code.replace(/-/g, '+').replace(/_/g, '/');
  const payload = decodeURIComponent(escape(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))));
  const parsed = JSON.parse(payload) as { name: string; trackIds: string[] };
  if (!parsed.name || !Array.isArray(parsed.trackIds)) throw new Error('INVALID_PLAYLIST');
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
