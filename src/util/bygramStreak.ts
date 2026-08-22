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
const MILESTONE_STORAGE_KEY = 'bygram-chat-streak-milestones-v1';
const STREAK_CHANGE_EVENT = 'bygram-chat-streak-change';
const DAY_MS = 24 * 60 * 60 * 1000;

export function recordBygramStreakMessage(accountId: string, message: ApiMessage) {
  if (!accountId || message.chatId === accountId || message.content.action || message.date <= 0) return;

  const messageAt = message.date * 1000;
  const store = loadStore();
  const accountRecords = store[accountId] || {};
  const current = accountRecords[message.chatId] || { days: {}, lastActivityAt: 0 };
  const dayKey = getDayKey(messageAt);
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

  let cursor = getUtcDayStart(now);

  if (!isQualifiedDay(record.days[getDayKey(cursor)])) {
    cursor -= DAY_MS;
  }

  let days = 0;
  while (isQualifiedDay(record.days[getDayKey(cursor)])) {
    days += 1;
    cursor -= DAY_MS;
  }

  return days ? { days } : undefined;
}

export function shouldOfferBygramStreakMilestone(accountId: string, peerId: string, days: number) {
  if (days < 10 || days % 10 !== 0) return false;

  try {
    const offered = JSON.parse(localStorage.getItem(MILESTONE_STORAGE_KEY) || '{}') as Record<string, number>;
    return offered[`${accountId}:${peerId}`] !== days;
  } catch {
    return true;
  }
}

export function markBygramStreakMilestoneOffered(accountId: string, peerId: string, days: number) {
  try {
    const offered = JSON.parse(localStorage.getItem(MILESTONE_STORAGE_KEY) || '{}') as Record<string, number>;
    offered[`${accountId}:${peerId}`] = days;
    localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify(offered));
  } catch {
    // A blocked localStorage must not affect messaging.
  }
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

function getDayKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUtcDayStart(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
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
