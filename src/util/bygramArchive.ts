import type { ApiMessage, ApiSticker } from '../api/types';

import bowTieGiftAnimation from '../assets/bygram/gifts/bow-tie.tgs';
import bowTieGift from '../assets/bygram/gifts/bow-tie.webp';
import freshSocksGiftAnimation from '../assets/bygram/gifts/fresh-socks.tgs';
import freshSocksGift from '../assets/bygram/gifts/fresh-socks.webp';
import gingerCookieGiftAnimation from '../assets/bygram/gifts/ginger-cookie.tgs';
import gingerCookieGift from '../assets/bygram/gifts/ginger-cookie.webp';
import hangingStarGiftAnimation from '../assets/bygram/gifts/hanging-star.tgs';
import hangingStarGift from '../assets/bygram/gifts/hanging-star.webp';
import homemadeCakeGift from '../assets/bygram/gifts/homemade-cake.svg';
import jellyBunnyGiftAnimation from '../assets/bygram/gifts/jelly-bunny.tgs';
import jellyBunnyGift from '../assets/bygram/gifts/jelly-bunny.webp';
import libertyFigureGiftAnimation from '../assets/bygram/gifts/liberty-figure.tgs';
import libertyFigureGift from '../assets/bygram/gifts/liberty-figure.webp';
import nailBraceletGiftAnimation from '../assets/bygram/gifts/nail-bracelet.tgs';
import nailBraceletGift from '../assets/bygram/gifts/nail-bracelet.webp';
import plushPepeGiftAnimation from '../assets/bygram/gifts/plush-pepe.tgs';
import plushPepeGift from '../assets/bygram/gifts/plush-pepe.webp';
import rareBirdGiftAnimation from '../assets/bygram/gifts/rare-bird.tgs';
import rareBirdGift from '../assets/bygram/gifts/rare-bird.webp';
import santaHatGift from '../assets/bygram/gifts/santa-hat.svg';
import sharpTongueGiftAnimation from '../assets/bygram/gifts/sharp-tongue.tgs';
import sharpTongueGift from '../assets/bygram/gifts/sharp-tongue.webp';
import spicedWineGift from '../assets/bygram/gifts/spiced-wine.svg';
import trappedHeartGiftAnimation from '../assets/bygram/gifts/trapped-heart.tgs';
import trappedHeartGift from '../assets/bygram/gifts/trapped-heart.webp';

export type BygramSettings = {
  isArchiveEnabled: boolean;
  isAntiDeleteEnabled: boolean;
  isEditHistoryEnabled: boolean;
  isMediaArchiveEnabled: boolean;
  isGhostModeEnabled: boolean;
  isChatStreakEnabled: boolean;
  isByProtoEnabled: boolean;
  isByProtoAutoAcceptProfiles: boolean;
  mediaArchiveLimitMb: number;
  messageBubbleStyle: BygramMessageBubbleStyle;
  messageBubbleColor: string;
  messageBubbleColorEnd: string;
  isMessageBubbleGradientEnabled: boolean;
  isMessageBubbleGiftAnimated: boolean;
  messageBubbleStickerImage?: string;
  messageBubbleSticker?: ApiSticker;
  messageBubbleCustomEmojiId?: string;
};

export type BygramMessageBubbleStyle = 'default' | 'ocean' | 'violet' | 'sunset' | 'mint'
  | 'homemade-cake' | 'jelly-bunny' | 'spiced-wine' | 'santa-hat'
  | 'plush-pepe' | 'bow-tie' | 'hanging-star' | 'trapped-heart' | 'rare-bird'
  | 'sharp-tongue' | 'nail-bracelet' | 'ginger-cookie' | 'fresh-socks' | 'liberty-figure'
  | 'custom';

export const BYGRAM_GIFT_BUBBLE_THEMES: Partial<Record<BygramMessageBubbleStyle, {
  image: string;
  animation?: string;
  telegramTitle?: string;
  background: string;
  tail: string;
  text: string;
}>> = {
  'plush-pepe': {
    image: plushPepeGift,
    animation: plushPepeGiftAnimation,
    telegramTitle: 'Plush Pepe',
    background: 'linear-gradient(145deg, #D9FFD5 0%, #70D67E 58%, #2D8C62 100%)',
    tail: '#2D8C62',
    text: '#173D31',
  },
  'homemade-cake': {
    image: homemadeCakeGift,
    background: 'linear-gradient(145deg, #FFF0C7 0%, #FFB28E 58%, #F27A83 100%)',
    tail: '#F27A83',
    text: '#552B36',
  },
  'jelly-bunny': {
    image: jellyBunnyGift,
    animation: jellyBunnyGiftAnimation,
    telegramTitle: 'Jelly Bunny',
    background: 'linear-gradient(145deg, #D8FBFF 0%, #83D8FF 52%, #6B8CFF 100%)',
    tail: '#6B8CFF',
    text: '#15345E',
  },
  'bow-tie': {
    image: bowTieGift,
    animation: bowTieGiftAnimation,
    telegramTitle: 'Bow Tie',
    background: 'linear-gradient(145deg, #E9D8FF 0%, #A27AFF 54%, #5B3AC3 100%)',
    tail: '#5B3AC3',
    text: '#2F1C68',
  },
  'hanging-star': {
    image: hangingStarGift,
    animation: hangingStarGiftAnimation,
    telegramTitle: 'Hanging Star',
    background: 'linear-gradient(145deg, #FFF4B8 0%, #FFD45A 55%, #E69A28 100%)',
    tail: '#E69A28',
    text: '#5A3B12',
  },
  'trapped-heart': {
    image: trappedHeartGift,
    animation: trappedHeartGiftAnimation,
    telegramTitle: 'Trapped Heart',
    background: 'linear-gradient(145deg, #DDF8FF 0%, #8DDDF3 48%, #E75E8D 100%)',
    tail: '#E75E8D',
    text: '#3E3155',
  },
  'rare-bird': {
    image: rareBirdGift,
    animation: rareBirdGiftAnimation,
    telegramTitle: 'Rare Bird',
    background: 'linear-gradient(145deg, #D7FFF6 0%, #63D7CF 48%, #426EDB 100%)',
    tail: '#426EDB',
    text: '#143F52',
  },
  'sharp-tongue': {
    image: sharpTongueGift,
    animation: sharpTongueGiftAnimation,
    telegramTitle: 'Sharp Tongue',
    background: 'linear-gradient(145deg, #FFB1C5 0%, #D94F7D 52%, #6D234E 100%)',
    tail: '#6D234E',
    text: '#FFFFFF',
  },
  'nail-bracelet': {
    image: nailBraceletGift,
    animation: nailBraceletGiftAnimation,
    telegramTitle: 'Nail Bracelet',
    background: 'linear-gradient(145deg, #FFF1B8 0%, #DDB652 52%, #8D6327 100%)',
    tail: '#8D6327',
    text: '#493312',
  },
  'ginger-cookie': {
    image: gingerCookieGift,
    animation: gingerCookieGiftAnimation,
    telegramTitle: 'Ginger Cookie',
    background: 'linear-gradient(145deg, #FFE2B1 0%, #C87935 55%, #75401F 100%)',
    tail: '#75401F',
    text: '#FFF8E9',
  },
  'fresh-socks': {
    image: freshSocksGift,
    animation: freshSocksGiftAnimation,
    telegramTitle: 'Fresh Socks',
    background: 'linear-gradient(145deg, #D5F8FF 0%, #62CBEA 48%, #FF718D 100%)',
    tail: '#FF718D',
    text: '#24415D',
  },
  'liberty-figure': {
    image: libertyFigureGift,
    animation: libertyFigureGiftAnimation,
    telegramTitle: 'Liberty Figure',
    background: 'linear-gradient(145deg, #D7FFF2 0%, #69C9B2 55%, #277A70 100%)',
    tail: '#277A70',
    text: '#17453F',
  },
  'spiced-wine': {
    image: spicedWineGift,
    background: 'linear-gradient(145deg, #B8325D 0%, #74163D 62%, #4B1634 100%)',
    tail: '#4B1634',
    text: '#FFF5E4',
  },
  'santa-hat': {
    image: santaHatGift,
    background: 'linear-gradient(145deg, #FF6570 0%, #D82958 58%, #9D1948 100%)',
    tail: '#9D1948',
    text: '#FFFFFF',
  },
};

const BYGRAM_BASIC_BUBBLE_THEMES: Partial<Record<BygramMessageBubbleStyle, {
  background: string;
  tail: string;
  text: string;
}>> = {
  ocean: { background: 'linear-gradient(145deg, #1687FF 0%, #0066E6 100%)', tail: '#0066E6', text: '#FFFFFF' },
  violet: { background: 'linear-gradient(145deg, #9B6DFF 0%, #6C45E8 100%)', tail: '#6C45E8', text: '#FFFFFF' },
  sunset: { background: 'linear-gradient(145deg, #FF7A59 0%, #E94373 100%)', tail: '#E94373', text: '#FFFFFF' },
  mint: { background: 'linear-gradient(145deg, #20BFA9 0%, #078B83 100%)', tail: '#078B83', text: '#FFFFFF' },
};

export function getBygramBubbleVisualStyle(presetId: BygramMessageBubbleStyle) {
  return BYGRAM_GIFT_BUBBLE_THEMES[presetId] || BYGRAM_BASIC_BUBBLE_THEMES[presetId];
}

export type BygramMessageVersion = {
  savedAt: number;
  message: ApiMessage;
};

export type BygramArchiveRecord = {
  key: string;
  chatId: string;
  messageId: number;
  savedAt: number;
  deletedAt?: number;
  message: ApiMessage;
  versions: BygramMessageVersion[];
};

export type BygramArchiveStats = {
  messageCount: number;
  deletedCount: number;
  mediaBytes: number;
};

type BygramMediaRecord = {
  key: string;
  savedAt: number;
  size: number;
  blob: Blob;
};

const DB_NAME = 'bygram-archive';
const DB_VERSION = 1;
const MESSAGE_STORE = 'messages';
const MEDIA_STORE = 'media';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'archive';
const SETTINGS_STORAGE_KEY = 'bygram-settings';
const BYTES_IN_MB = 1024 * 1024;

const DEFAULT_SETTINGS: BygramSettings = {
  isArchiveEnabled: true,
  isAntiDeleteEnabled: true,
  isEditHistoryEnabled: true,
  isMediaArchiveEnabled: false,
  isGhostModeEnabled: false,
  isChatStreakEnabled: true,
  isByProtoEnabled: true,
  isByProtoAutoAcceptProfiles: true,
  mediaArchiveLimitMb: 256,
  messageBubbleStyle: 'default',
  messageBubbleColor: '#7C5CFC',
  messageBubbleColorEnd: '#4E8BFF',
  isMessageBubbleGradientEnabled: true,
  isMessageBubbleGiftAnimated: true,
};

let databasePromise: Promise<IDBDatabase> | undefined;
let settings = loadSettings();
const settingsListeners = new Set<(nextSettings: BygramSettings) => void>();

applyMessageBubbleStyle(settings);

export function getBygramSettings() {
  return settings;
}

// Telegram refuses paid emoji from accounts without Premium, so bygram keeps them locally and ships
// them to the other side inside a ByProto packet. Without that carrier there is nothing to restore
// them from, which is why the same setting decides where paid emoji may be offered.
export function canUseBygramPremiumEmoji() {
  return settings.isByProtoEnabled;
}

export function updateBygramSettings(patch: Partial<BygramSettings>) {
  settings = { ...settings, ...patch };
  applyMessageBubbleStyle(settings);
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  void runTransaction(SETTINGS_STORE, 'readwrite', (store) => requestAsPromise(store.put(settings, SETTINGS_KEY)));
  settingsListeners.forEach((listener) => listener(settings));
  return settings;
}

export function subscribeBygramSettings(listener: (nextSettings: BygramSettings) => void) {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

function applyMessageBubbleStyle(nextSettings: BygramSettings) {
  const root = document.documentElement;
  const isCustom = nextSettings.messageBubbleStyle !== 'default';
  root.classList.toggle('bygram-ghost-mode', nextSettings.isGhostModeEnabled);
  const giftTheme = BYGRAM_GIFT_BUBBLE_THEMES[nextSettings.messageBubbleStyle];
  const customStickerImage = nextSettings.messageBubbleStyle === 'custom'
    ? nextSettings.messageBubbleStickerImage
    : undefined;
  const giftImage = giftTheme?.image || customStickerImage;
  root.classList.toggle('bygram-custom-message-bubble', isCustom);
  root.classList.toggle(
    'bygram-gift-message-bubble',
    Boolean(giftImage || nextSettings.messageBubbleCustomEmojiId || nextSettings.messageBubbleSticker),
  );
  root.classList.toggle(
    'bygram-animated-message-bubble',
    Boolean((giftImage || nextSettings.messageBubbleCustomEmojiId) && nextSettings.isMessageBubbleGiftAnimated),
  );
  if (!isCustom) {
    root.style.removeProperty('--bygram-own-bubble-background');
    root.style.removeProperty('--bygram-own-bubble-tail');
    root.style.removeProperty('--bygram-own-bubble-text');
    root.style.removeProperty('--bygram-own-bubble-gift');
    return;
  }

  const customColor = normalizeHexColor(nextSettings.messageBubbleColor);
  const customColorEnd = normalizeHexColor(nextSettings.messageBubbleColorEnd);
  const customBackground = nextSettings.isMessageBubbleGradientEnabled
    ? `linear-gradient(145deg, ${customColor} 0%, ${customColorEnd} 100%)`
    : customColor;
  const selectedStyle = nextSettings.messageBubbleStyle === 'custom'
    ? { background: customBackground, tail: nextSettings.isMessageBubbleGradientEnabled ? customColorEnd : customColor }
    : giftTheme || BYGRAM_BASIC_BUBBLE_THEMES[nextSettings.messageBubbleStyle];
  if (!selectedStyle) return;
  const textColor = giftTheme?.text || (nextSettings.messageBubbleStyle === 'custom'
    ? getContrastTextColor(customColor)
    : '#FFFFFF');
  root.style.setProperty('--bygram-own-bubble-background', selectedStyle.background);
  root.style.setProperty('--bygram-own-bubble-tail', selectedStyle.tail);
  root.style.setProperty('--bygram-own-bubble-text', textColor);
  if (giftImage) {
    root.style.setProperty('--bygram-own-bubble-gift', `url("${giftImage}")`);
  } else {
    root.style.removeProperty('--bygram-own-bubble-gift');
  }
}

function normalizeHexColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value) ? value : DEFAULT_SETTINGS.messageBubbleColor;
}

function getContrastTextColor(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16)) || [0, 0, 0];
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return luminance > 150 ? '#17212B' : '#FFFFFF';
}

export async function archiveNewMessage(message: ApiMessage) {
  if (!settings.isArchiveEnabled || message.id <= 0) return;

  const key = buildMessageKey(message.chatId, message.id);
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const current = await requestAsPromise<BygramArchiveRecord | undefined>(store.get(key));
    const record: BygramArchiveRecord = {
      key,
      chatId: message.chatId,
      messageId: message.id,
      savedAt: Date.now(),
      deletedAt: current?.deletedAt,
      message: cloneMessage(message),
      versions: current?.versions || [],
    };
    await requestAsPromise(store.put(record));
  });
}

export async function archiveEditedMessage(previousMessage: ApiMessage, message: ApiMessage) {
  if (!settings.isArchiveEnabled || message.id <= 0) return;

  const key = buildMessageKey(message.chatId, message.id);
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const current = await requestAsPromise<BygramArchiveRecord | undefined>(store.get(key));
    const versions = current?.versions || [];
    const hasContentChanged = JSON.stringify(previousMessage.content) !== JSON.stringify(message.content);

    if (settings.isEditHistoryEnabled && hasContentChanged) {
      versions.push({ savedAt: Date.now(), message: cloneMessage(previousMessage) });
    }

    const record: BygramArchiveRecord = {
      key,
      chatId: message.chatId,
      messageId: message.id,
      savedAt: Date.now(),
      deletedAt: current?.deletedAt,
      message: cloneMessage(message),
      versions,
    };
    await requestAsPromise(store.put(record));
  });
}

export async function archiveDeletedMessage(message: ApiMessage) {
  if (!settings.isArchiveEnabled || message.id <= 0) return;

  const key = buildMessageKey(message.chatId, message.id);
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const current = await requestAsPromise<BygramArchiveRecord | undefined>(store.get(key));
    const record: BygramArchiveRecord = {
      key,
      chatId: message.chatId,
      messageId: message.id,
      savedAt: current?.savedAt || Date.now(),
      deletedAt: Date.now(),
      message: cloneMessage(message),
      versions: current?.versions || [],
    };
    await requestAsPromise(store.put(record));
  });
}

export async function markArchivedMessagesDeleted(chatId: string, messageIds: number[]) {
  if (!settings.isArchiveEnabled) return;

  const deletedAt = Date.now();
  await runTransaction(MESSAGE_STORE, 'readwrite', async (store) => {
    const records = await Promise.all(messageIds.map((id) => requestAsPromise<BygramArchiveRecord | undefined>(
      store.get(buildMessageKey(chatId, id)),
    )));

    await Promise.all(records.filter((record): record is BygramArchiveRecord => (
      Boolean(record) && messageIds.includes(record.messageId)
    )).map((record) => requestAsPromise(store.put({ ...record, deletedAt }))));
  });
}

export async function getArchivedMessages(chatId: string, messageIds: number[]) {
  return runTransaction(MESSAGE_STORE, 'readonly', async (store) => {
    const records = await Promise.all(messageIds.map((id) => requestAsPromise<BygramArchiveRecord | undefined>(
      store.get(buildMessageKey(chatId, id)),
    )));
    return records.filter((record): record is BygramArchiveRecord => Boolean(record));
  });
}

export async function getArchivedRetainedMessages(chatId: string) {
  if (!settings.isArchiveEnabled) return [];

  const records = await runTransaction(MESSAGE_STORE, 'readonly', (store) => (
    requestAsPromise<BygramArchiveRecord[]>(store.index('chatId').getAll(IDBKeyRange.only(chatId)))
  ));

  return records.filter((record) => (
    (settings.isAntiDeleteEnabled && Boolean(record.deletedAt))
    || record.message.content.ttlSeconds !== undefined
  ));
}

export async function getArchivedChatMessages(chatId: string) {
  const records = await runTransaction(MESSAGE_STORE, 'readonly', (store) => (
    requestAsPromise<BygramArchiveRecord[]>(store.index('chatId').getAll(IDBKeyRange.only(chatId)))
  ));

  return records.sort((first, second) => (
    first.message.date - second.message.date || first.messageId - second.messageId
  ));
}

export async function getMessageHistory(chatId: string, messageId: number) {
  const record = await runTransaction(MESSAGE_STORE, 'readonly', (store) => (
    requestAsPromise<BygramArchiveRecord | undefined>(store.get(buildMessageKey(chatId, messageId)))
  ));
  return record?.versions || [];
}

export async function archiveMedia(key: string, blob: Blob) {
  if (!settings.isMediaArchiveEnabled || !blob.size) return;

  const record: BygramMediaRecord = {
    key,
    blob,
    size: blob.size,
    savedAt: Date.now(),
  };

  await runTransaction(MEDIA_STORE, 'readwrite', async (store) => {
    await requestAsPromise(store.put(record));
    const records = await requestAsPromise<BygramMediaRecord[]>(store.getAll());
    let totalSize = records.reduce((total, item) => total + item.size, 0);
    const limit = settings.mediaArchiveLimitMb * BYTES_IN_MB;

    for (const item of records.sort((first, second) => first.savedAt - second.savedAt)) {
      if (totalSize <= limit) break;
      await requestAsPromise(store.delete(item.key));
      totalSize -= item.size;
    }
  });
}

export async function getArchivedMedia(key: string) {
  if (!settings.isMediaArchiveEnabled) return undefined;

  const record = await runTransaction(MEDIA_STORE, 'readonly', (store) => (
    requestAsPromise<BygramMediaRecord | undefined>(store.get(key))
  ));
  return record?.blob;
}

export async function getBygramArchiveStats(): Promise<BygramArchiveStats> {
  const [messages, media] = await Promise.all([
    runTransaction(MESSAGE_STORE, 'readonly', (store) => requestAsPromise<BygramArchiveRecord[]>(store.getAll())),
    runTransaction(MEDIA_STORE, 'readonly', (store) => requestAsPromise<BygramMediaRecord[]>(store.getAll())),
  ]);

  return {
    messageCount: messages.length,
    deletedCount: messages.filter(({ deletedAt }) => Boolean(deletedAt)).length,
    mediaBytes: media.reduce((total, item) => total + item.size, 0),
  };
}

export async function getBygramArchiveFirstSavedAt() {
  return runTransaction(MESSAGE_STORE, 'readonly', (store) => new Promise<number | undefined>((resolve, reject) => {
    let firstSavedAt: number | undefined;
    const request = store.openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(firstSavedAt);
        return;
      }
      const { savedAt } = cursor.value as BygramArchiveRecord;
      if (savedAt > 0) firstSavedAt = Math.min(firstSavedAt ?? savedAt, savedAt);
      cursor.continue();
    };
  }));
}

export async function clearBygramArchive() {
  await Promise.all([
    runTransaction(MESSAGE_STORE, 'readwrite', (store) => requestAsPromise(store.clear())),
    runTransaction(MEDIA_STORE, 'readwrite', (store) => requestAsPromise(store.clear())),
  ]);
}

function loadSettings(): BygramSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) as Partial<BygramSettings> } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function buildMessageKey(chatId: string, messageId: number) {
  return `${chatId}:${messageId}`;
}

function cloneMessage(message: ApiMessage) {
  return structuredClone(message);
}

function getDatabase() {
  databasePromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = database.createObjectStore(MESSAGE_STORE, { keyPath: 'key' });
        store.createIndex('chatId', 'chatId');
        store.createIndex('messageId', 'messageId');
        store.createIndex('deletedAt', 'deletedAt');
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return databasePromise;
}

async function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
) {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, mode);
  const transactionPromise = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  const result = await callback(transaction.objectStore(storeName));
  await transactionPromise;
  return result;
}

function requestAsPromise<T = IDBValidKey>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
