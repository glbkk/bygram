import type { ByProtoMusicPlaylistPayload, ByProtoMusicTrackPayload } from '../../byproto/types';
import type { BygramMusicTrack } from './musicTypes';

import { bygramMusicPlayer } from './musicPlayer';
import { bygramMusicApi } from './serverlessMusic';

export function trackFromByProtoPayload(payload: ByProtoMusicTrackPayload): BygramMusicTrack {
  return {
    id: payload.id,
    title: payload.title,
    artist: payload.artist,
    ...(payload.album ? { album: payload.album } : {}),
    ...(payload.genre ? { genre: payload.genre } : {}),
    durationSeconds: payload.durationSeconds,
    ...(payload.artworkUrl ? { artworkUrl: payload.artworkUrl } : {}),
    audioUrl: payload.audioUrl,
    mimeType: payload.mimeType || 'audio/mpeg',
  };
}

export async function playByProtoMusicTrack(payload: ByProtoMusicTrackPayload) {
  const track = trackFromByProtoPayload(payload);
  bygramMusicApi.rememberMusicTrack(track);
  await bygramMusicApi.ensureSession();
  await bygramMusicPlayer.play(track, 'search', [track]);
  return track;
}

export async function favoriteByProtoMusicTrack(payload: ByProtoMusicTrackPayload) {
  const track = trackFromByProtoPayload(payload);
  bygramMusicApi.rememberMusicTrack(track);
  await bygramMusicApi.ensureSession();
  await bygramMusicApi.setMusicLiked(track.id, true);
  bygramMusicPlayer.reflectLiked(track.id, true);
  return track;
}

let pendingPlaylistTrack: BygramMusicTrack | undefined;

export function queueByProtoTrackForPlaylist(payload: ByProtoMusicTrackPayload) {
  pendingPlaylistTrack = trackFromByProtoPayload(payload);
  bygramMusicApi.rememberMusicTrack(pendingPlaylistTrack);
  return pendingPlaylistTrack;
}

export function takePendingPlaylistTrack() {
  const track = pendingPlaylistTrack;
  pendingPlaylistTrack = undefined;
  return track;
}

export async function playByProtoMusicPlaylist(payload: ByProtoMusicPlaylistPayload) {
  await bygramMusicApi.ensureSession();
  const playlist = await bygramMusicApi.resolveMusicPlaylistPayload(payload.name, payload.trackIds);
  if (!playlist.tracks.length) throw new Error('PLAYLIST_EMPTY');
  await bygramMusicPlayer.play(playlist.tracks[0], 'playlist', playlist.tracks);
  return playlist;
}

export async function saveByProtoMusicPlaylist(payload: ByProtoMusicPlaylistPayload) {
  await bygramMusicApi.ensureSession();
  return bygramMusicApi.importMusicPlaylist(payload.name, payload.trackIds);
}
