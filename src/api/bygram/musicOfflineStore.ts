import {
  createStore, del, get, keys as getKeys, set,
} from 'idb-keyval';

import type { BygramMusicTrack } from './musicTypes';

type OfflineTrackRecord = {
  id: string;
  track: BygramMusicTrack;
  blob: Blob;
  savedAt: number;
  size: number;
};

const offlineStore = createStore('bygram-music-offline', 'tracks');
const listeners = new Set<(ids: Set<string>) => void>();
let cachedIds: Set<string> | undefined;
let idsPromise: Promise<Set<string>> | undefined;

export async function listOfflineTrackIds() {
  if (cachedIds) return new Set(cachedIds);
  idsPromise ||= getKeys(offlineStore).then((keys) => {
    cachedIds = new Set(keys.map(String));
    return cachedIds;
  }).finally(() => {
    idsPromise = undefined;
  });
  return new Set(await idsPromise);
}

export function subscribeOfflineTrackIds(listener: (ids: Set<string>) => void) {
  listeners.add(listener);
  void listOfflineTrackIds().then((ids) => listener(new Set(ids)));
  return () => {
    listeners.delete(listener);
  };
}

export async function hasOfflineTrack(trackId: string) {
  const ids = await listOfflineTrackIds();
  return ids.has(trackId);
}

export async function getOfflineTrackBlob(trackId: string) {
  const record = await get<OfflineTrackRecord>(trackId, offlineStore);
  return record?.blob;
}

export async function putOfflineTrack(track: BygramMusicTrack, blob: Blob) {
  const record: OfflineTrackRecord = {
    id: track.id,
    track: {
      ...track,
      mimeType: blob.type || track.mimeType || 'audio/mpeg',
    },
    blob,
    savedAt: Date.now(),
    size: blob.size,
  };
  await set(track.id, record, offlineStore);
  const ids = await listOfflineTrackIds();
  ids.add(track.id);
  cachedIds = ids;
  emit(ids);
  return record;
}

export async function deleteOfflineTrack(trackId: string) {
  await del(trackId, offlineStore);
  const ids = await listOfflineTrackIds();
  ids.delete(trackId);
  cachedIds = ids;
  emit(ids);
}

function emit(ids: Set<string>) {
  const snapshot = new Set(ids);
  listeners.forEach((listener) => listener(snapshot));
}
