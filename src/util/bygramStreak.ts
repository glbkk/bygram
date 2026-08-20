import type { ApiMessage } from '../api/types';

export type BygramStreak = {
  days: number;
};

type DayActivity = {
  incoming?: true;
  outgoing?: true;
  latestAt: number;
};

type StreakRecord = {
  days: Record<string, DayActivity>;
  lastActivityAt: number;
};

type StreakStore = Record<string, Record<string, StreakRecord>>;

const STORAGE_KEY = 'bygram-chat-streaks-v1';
const STREAK_CHANGE_EVENT = 'bygram-chat-streak-change';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_STREAK_DAYS = 3;

export function recordBygramStreakMessage(accountId: string, message: ApiMessage) {
  if (!accountId || message.chatId === accountId || message.content.action || message.date <= 0) return;

  const messageAt = message.date * 1000;
  const store = loadStore();
  const accountRecords = store[accountId] || {};
  const current = accountRecords[message.chatId] || { days: {}, lastActivityAt: 0 };
  const dayKey = getLocalDayKey(messageAt);
  const day = current.days[dayKey] || { latestAt: 0 };

  if (message.isOutgoing) {
    day.outgoing = true;
  } else {
    day.incoming = true;
  }
  day.latestAt = Math.max(day.latestAt, messageAt);
  current.days[dayKey] = day;
  current.lastActivityAt = Math.max(current.lastActivityAt, messageAt);
  accountRecords[message.chatId] = current;
  store[accountId] = accountRecords;

  saveStore(store);
  window.dispatchEvent(new CustomEvent(STREAK_CHANGE_EVENT, {
    detail: { accountId, peerId: message.chatId },
  }));
}

export function getBygramStreak(accountId?: string, peerId?: string, now = Date.now()): BygramStreak | undefined {
  if (!accountId || !peerId) return undefined;

  const record = loadStore()[accountId]?.[peerId];
  if (!record || now - record.lastActivityAt >= DAY_MS) return undefined;

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  if (!isQualifiedDay(record.days[getLocalDayKey(cursor.getTime())])) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let days = 0;
  while (isQualifiedDay(record.days[getLocalDayKey(cursor.getTime())])) {
    days += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return days >= MIN_STREAK_DAYS ? { days } : undefined;
}

export function subscribeToBygramStreak(
  accountId: string,
  peerId: string,
  callback: NoneToVoidFunction,
) {
  const handleChange = (event: Event) => {
    const detail = (event as CustomEvent<{ accountId: string; peerId: string }>).detail;
    if (detail.accountId === accountId && detail.peerId === peerId) callback();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };

  window.addEventListener(STREAK_CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(STREAK_CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function isQualifiedDay(activity?: DayActivity) {
  return Boolean(activity?.incoming && activity.outgoing);
}

function getLocalDayKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadStore(): StreakStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as StreakStore;
  } catch {
    return {};
  }
}

function saveStore(store: StreakStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Streaks are optional and must never interrupt message processing.
  }
}
