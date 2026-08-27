import { getGlobal } from '../../global';

import type {
  BygramMusicAlbum,
  BygramMusicHome,
  BygramMusicPlay,
  BygramMusicPlaylist,
  BygramMusicSearch,
  BygramMusicTrack,
} from './musicTypes';

type StoredPlaylist = Pick<BygramMusicPlaylist, 'id' | 'name' | 'trackIds' | 'createdAt' | 'updatedAt'>;
type MusicState = {
  likedIds: string[];
  recentIds: string[];
  playlists: StoredPlaylist[];
  playCounts: Record<string, number>;
};

const STATE_KEY = 'bygram-serverless-music-v1';
const CATALOG_PATH = 'bygram-music/catalog.json';
const MAX_RECENT = 40;
let catalogPromise: Promise<BygramMusicTrack[]> | undefined;

class BygramServerlessMusic {
  ensureSession() {
    return Promise.resolve(undefined);
  }

  async getMusicHome(): Promise<BygramMusicHome> {
    const [tracks, state] = await Promise.all([loadCatalog(), Promise.resolve(loadState())]);
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const favorites = state.likedIds.map((id) => byId.get(id)).filter(Boolean);
    const recent = state.recentIds.map((id) => byId.get(id)).filter(Boolean);
    const daily = deterministicOrder(tracks, getDateSeed()).slice(0, 20);
    const wave = buildWave(tracks, favorites, recent, state.playCounts).slice(0, 40);
    return {
      daily,
      wave,
      recent,
      favorites,
      playlists: state.playlists.map((playlist) => hydratePlaylist(playlist, byId)),
      librarySize: tracks.length,
    };
  }

  async searchMusic(query: string): Promise<BygramMusicSearch> {
    const tracks = await loadCatalog();
    const normalized = normalize(query);
    const found = tracks.filter((track) => normalize(
      `${track.title} ${track.artist} ${track.album || ''} ${track.genre || ''}`,
    ).includes(normalized));
    return { tracks: found.slice(0, 40), albums: groupAlbums(found).slice(0, 20) };
  }

  async getMusicAlbum(albumId: string) {
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
    const tracks = await loadCatalog();
    const source = tracks.find(({ id }) => id === trackId);
    if (!source) return [];
    return [source, ...tracks.filter(({ id }) => id !== trackId).sort((first, second) => (
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
    const byId = new Map((await loadCatalog()).map((track) => [track.id, track]));
    return {
      ...shared,
      tracks: shared.trackIds.map((id) => byId.get(id)).filter(Boolean),
      shareCode,
      isOwn: false,
      ownerTelegramUserId: '',
    } as BygramMusicPlaylist;
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
    return this.getPlaylist(playlist.id);
  }

  async startMusicPlay(trackId: string): Promise<BygramMusicPlay> {
    const track = (await loadCatalog()).find(({ id }) => id === trackId);
    if (!track) throw new Error('TRACK_NOT_FOUND');
    rememberPlayed(trackId);
    return { id: crypto.randomUUID(), track, streamUrl: resolveAssetUrl(track.audioUrl) };
  }

  updateMusicPlay() {
    return Promise.resolve({ ok: true as const });
  }

  getMusicAudioUrl(streamUrl: string) {
    return streamUrl;
  }

  async downloadMusicTrack(track: BygramMusicTrack) {
    const response = await fetch(resolveAssetUrl(track.audioUrl));
    if (!response.ok) throw new Error('TRACK_DOWNLOAD_FAILED');
    const blob = await response.blob();
    const extension = track.mimeType === 'audio/mpeg' ? 'mp3' : 'm4a';
    return new File([blob], `${safeFileName(track.artist)} - ${safeFileName(track.title)}.${extension}`, {
      type: track.mimeType,
    });
  }

  private async getPlaylist(id: string) {
    const playlist = loadState().playlists.find((item) => item.id === id);
    if (!playlist) throw new Error('PLAYLIST_NOT_FOUND');
    const byId = new Map((await loadCatalog()).map((track) => [track.id, track]));
    return hydratePlaylist(playlist, byId);
  }
}

function loadCatalog() {
  catalogPromise ||= fetch(resolveAssetUrl(CATALOG_PATH)).then(async (response) => {
    if (!response.ok) throw new Error('MUSIC_CATALOG_UNAVAILABLE');
    return response.json() as Promise<BygramMusicTrack[]>;
  });
  return catalogPromise;
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

function rememberPlayed(trackId: string) {
  const state = loadState();
  state.recentIds = [trackId, ...state.recentIds.filter((id) => id !== trackId)].slice(0, MAX_RECENT);
  state.playCounts[trackId] = (state.playCounts[trackId] || 0) + 1;
  saveState(state);
}

function hydratePlaylist(playlist: StoredPlaylist, byId: Map<string, BygramMusicTrack>): BygramMusicPlaylist {
  return {
    ...playlist,
    type: 'custom',
    ownerTelegramUserId: getGlobal().currentUserId || '',
    trackIds: [...playlist.trackIds],
    tracks: playlist.trackIds.map((id) => byId.get(id)).filter(Boolean),
    isOwn: true,
  };
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
  return value.toLocaleLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim();
}

function resolveAssetUrl(path: string) {
  return new URL(path, document.baseURI).toString();
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
