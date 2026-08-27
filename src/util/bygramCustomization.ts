import { MAIN_IDB_STORE } from './browser/idb';

export type BygramCustomizationMedia = {
  blob: Blob;
  mimeType: string;
  source: 'gallery' | 'telegram-gif' | 'byproto';
  updatedAt: number;
};

const KEY_PREFIX = 'bygram-customization:';
const listeners = new Map<string, Set<NoneToVoidFunction>>();

export function getBygramChatWallpaperKey(accountId: string, chatId: string) {
  return `${KEY_PREFIX}wallpaper:${accountId}:${chatId}`;
}

export function getBygramProfileBannerKey(accountId: string) {
  return `${KEY_PREFIX}profile-banner:${accountId}`;
}

export async function getBygramCustomizationMedia(key?: string) {
  if (!key) return undefined;
  return MAIN_IDB_STORE.get<BygramCustomizationMedia>(key);
}

export async function saveBygramCustomizationMedia(
  key: string,
  blob: Blob,
  source: BygramCustomizationMedia['source'],
) {
  const media: BygramCustomizationMedia = {
    blob,
    mimeType: blob.type,
    source,
    updatedAt: Date.now(),
  };

  await MAIN_IDB_STORE.set(key, media);
  notify(key);
  return media;
}

export async function removeBygramCustomizationMedia(key: string) {
  await MAIN_IDB_STORE.del(key);
  notify(key);
}

export function subscribeBygramCustomization(key: string | undefined, listener: NoneToVoidFunction) {
  if (!key) return () => undefined;

  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  keyListeners.add(listener);

  return () => {
    keyListeners.delete(listener);
    if (!keyListeners.size) listeners.delete(key);
  };
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}
