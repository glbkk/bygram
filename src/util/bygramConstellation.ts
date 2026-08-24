import type { ApiMessage } from '../api/types';

export type BygramConstellationDay = {
  key: string;
  pairKey: string;
  date: string;
  ordinal: number;
  messages: number;
  voiceMessages: number;
  roundVideos: number;
  media: number;
  gifts: number;
  premiumGifted: number;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  firstMessageId: number;
  lastMessageId: number;
  messageIds: number[];
  significance: number;
  planeStreak?: number;
  planeMilestone?: number;
};

export type BygramConstellationPoint = {
  day: BygramConstellationDay;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export interface BygramConstellationRepository {
  getDays(accountId: string, peerId: string): Promise<BygramConstellationDay[]>;
  importMessages(accountId: string, peerId: string, messages: ApiMessage[]): Promise<void>;
  recordMessage(accountId: string, message: ApiMessage): Promise<void>;
}

const DB_NAME = 'bygram-constellations';
const DB_VERSION = 1;
const DAY_STORE = 'days';
const PAIR_INDEX = 'pairKey';
const CHANGE_EVENT = 'bygram-constellation-change';

class LocalBygramConstellationRepository implements BygramConstellationRepository {
  private databasePromise?: Promise<IDBDatabase>;

  async getDays(accountId: string, peerId: string) {
    const pairKey = getPairKey(accountId, peerId);
    const records = await this.runTransaction('readonly', (store) => requestAsPromise<BygramConstellationDay[]>(
      store.index(PAIR_INDEX).getAll(IDBKeyRange.only(pairKey)),
    ));
    return addPlaneStreaks(records.sort((first, second) => first.ordinal - second.ordinal));
  }

  async importMessages(accountId: string, peerId: string, messages: ApiMessage[]) {
    const validMessages = messages.filter((message) => (
      message.chatId === peerId && message.id > 0 && message.date > 0
    ));
    if (!validMessages.length) return;

    await this.runTransaction('readwrite', async (store) => {
      const pairKey = getPairKey(accountId, peerId);
      const existing = await requestAsPromise<BygramConstellationDay[]>(
        store.index(PAIR_INDEX).getAll(IDBKeyRange.only(pairKey)),
      );
      const byDate = new Map(existing.map((day) => [day.date, day]));
      let nextOrdinal = existing.reduce((max, day) => Math.max(max, day.ordinal), -1) + 1;

      for (const message of validMessages.sort((first, second) => first.date - second.date || first.id - second.id)) {
        const date = getDayKey(message.date * 1000);
        const current = byDate.get(date) || createDay(pairKey, date, nextOrdinal++);
        if (addMessageToDay(current, message)) byDate.set(date, current);
      }

      await Promise.all(Array.from(byDate.values()).map((day) => requestAsPromise(store.put(day))));
    });
    dispatchChange(accountId, peerId);
  }

  async recordMessage(accountId: string, message: ApiMessage) {
    if (!accountId || message.chatId === accountId || message.id <= 0 || message.date <= 0) return;

    const peerId = message.chatId;
    const pairKey = getPairKey(accountId, peerId);
    const date = getDayKey(message.date * 1000);
    await this.runTransaction('readwrite', async (store) => {
      const key = `${pairKey}:${date}`;
      let day = await requestAsPromise<BygramConstellationDay | undefined>(store.get(key));
      if (!day) {
        const records = await requestAsPromise<BygramConstellationDay[]>(
          store.index(PAIR_INDEX).getAll(IDBKeyRange.only(pairKey)),
        );
        day = createDay(pairKey, date, records.reduce((max, item) => Math.max(max, item.ordinal), -1) + 1);
      }
      if (addMessageToDay(day, message)) await requestAsPromise(store.put(day));
    });
    dispatchChange(accountId, peerId);
  }

  private getDatabase() {
    this.databasePromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DAY_STORE)) {
          const store = database.createObjectStore(DAY_STORE, { keyPath: 'key' });
          store.createIndex(PAIR_INDEX, PAIR_INDEX);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
    return this.databasePromise;
  }

  private async runTransaction<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T>,
  ) {
    const database = await this.getDatabase();
    const transaction = database.transaction(DAY_STORE, mode);
    const completion = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const result = await callback(transaction.objectStore(DAY_STORE));
    await completion;
    return result;
  }
}

export const bygramConstellationRepository: BygramConstellationRepository = (
  new LocalBygramConstellationRepository()
);

export function subscribeBygramConstellation(
  accountId: string,
  peerId: string,
  callback: NoneToVoidFunction,
) {
  const handleChange = (event: Event) => {
    const detail = (event as CustomEvent<{ accountId: string; peerId: string }>).detail;
    if (detail.accountId === accountId && detail.peerId === peerId) callback();
  };
  window.addEventListener(CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(CHANGE_EVENT, handleChange);
}

export function getBygramConstellationSeed(accountId: string, peerId: string) {
  const value = getPairKey(accountId, peerId);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildBygramConstellationPoints(
  days: BygramConstellationDay[], seed: number,
): BygramConstellationPoint[] {
  const styleRandom = createRandom(seed);
  const arms = 2 + Math.floor(styleRandom() * 3);
  const direction = styleRandom() > 0.5 ? 1 : -1;
  const turn = 0.38 + styleRandom() * 0.16;
  const flatten = 0.72 + styleRandom() * 0.24;
  const tilt = styleRandom() * Math.PI * 2;

  return days.map((day) => {
    const random = createRandom(seed ^ Math.imul(day.ordinal + 1, 0x9E3779B1));
    const index = day.ordinal + 2;
    const arm = day.ordinal % arms;
    const radius = 22 + Math.sqrt(index) * (13 + styleRandom() * 0.015);
    const angle = direction * (index * turn + arm * Math.PI * 2 / arms) + (random() - 0.5) * 0.48;
    const spread = 0.62 + random() * 0.7;
    const rawX = Math.cos(angle) * radius * spread;
    const rawY = Math.sin(angle) * radius * spread * flatten;
    const x = rawX * Math.cos(tilt) - rawY * Math.sin(tilt) + (random() - 0.5) * 12;
    const y = rawX * Math.sin(tilt) + rawY * Math.cos(tilt) + (random() - 0.5) * 12;
    return {
      day,
      x,
      y,
      radius: 1.35 + day.significance * 3.1,
      phase: random() * Math.PI * 2,
    };
  });
}

function createDay(pairKey: string, date: string, ordinal: number): BygramConstellationDay {
  return {
    key: `${pairKey}:${date}`,
    pairKey,
    date,
    ordinal,
    messages: 0,
    voiceMessages: 0,
    roundVideos: 0,
    media: 0,
    gifts: 0,
    premiumGifted: 0,
    hasIncoming: false,
    hasOutgoing: false,
    firstMessageId: 0,
    lastMessageId: 0,
    messageIds: [],
    significance: 0.2,
  };
}

function addMessageToDay(day: BygramConstellationDay, message: ApiMessage) {
  if (day.messageIds.includes(message.id)) return false;

  const { content } = message;
  const actionType = content.action?.type;
  const isPremiumGift = actionType === 'giftPremium' || actionType === 'giftCode';
  const isGift = isPremiumGift || actionType === 'giftStars' || actionType === 'giftTon'
    || actionType === 'starGift' || actionType === 'starGiftUnique';

  day.messageIds.push(message.id);
  day.messages += 1;
  day.hasOutgoing ||= message.isOutgoing;
  day.hasIncoming ||= !message.isOutgoing;
  day.firstMessageId = day.firstMessageId ? Math.min(day.firstMessageId, message.id) : message.id;
  day.lastMessageId = Math.max(day.lastMessageId, message.id);
  if (content.voice) day.voiceMessages += 1;
  if (content.video?.isRound) day.roundVideos += 1;
  if (content.photo || (content.video && !content.video.isRound) || content.document
    || content.audio || content.sticker || content.paidMedia) {
    day.media += 1;
  }
  if (isGift) day.gifts += 1;
  if (isPremiumGift) day.premiumGifted += 1;
  day.significance = calculateSignificance(day);
  return true;
}

function calculateSignificance(day: BygramConstellationDay) {
  const activity = Math.log1p(day.messages) / Math.log(81);
  const media = Math.log1p(day.media + day.voiceMessages + day.roundVideos) / Math.log(21);
  const special = Math.min(0.34, day.gifts * 0.16 + day.premiumGifted * 0.22);
  return Math.min(1, 0.18 + Math.min(0.42, activity * 0.42) + Math.min(0.2, media * 0.2) + special);
}

function addPlaneStreaks(days: BygramConstellationDay[]) {
  let streak = 0;
  let previousDayStart = 0;
  return [...days].sort((first, second) => first.date.localeCompare(second.date)).map((day) => {
    const dayStart = Date.parse(`${day.date}T00:00:00Z`);
    if (day.hasIncoming && day.hasOutgoing) {
      streak = previousDayStart && dayStart - previousDayStart === 24 * 60 * 60 * 1000 ? streak + 1 : 1;
      previousDayStart = dayStart;
    } else {
      streak = 0;
      previousDayStart = 0;
    }
    return {
      ...day,
      planeStreak: streak || undefined,
      planeMilestone: streak >= 10 && streak % 10 === 0 ? streak : undefined,
      significance: Math.min(1, day.significance + (streak >= 10 && streak % 10 === 0 ? 0.14 : 0)),
    };
  }).sort((first, second) => first.ordinal - second.ordinal);
}

function getPairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(':');
}

function getDayKey(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dispatchChange(accountId: string, peerId: string) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { accountId, peerId } }));
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function requestAsPromise<T = IDBValidKey>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
