import type { ApiUser, ApiUserStatus } from '../api/types';
import type { OldLangFn } from '../hooks/useOldLang';

import { ANONYMOUS_USER_ID, SERVICE_NOTIFICATIONS_USER_ID } from '../config';
import { getUserStatus } from '../global/helpers/users';
import { getBygramSettings } from './bygramArchive';
import { isUserId } from './entities/ids';

type ObservedStore = Record<string, Record<string, number>>;

const STORAGE_KEY = 'bygram-observed-online-v1';
const CHANGE_EVENT = 'bygram-observed-online-change';
const WRITE_THROTTLE_MS = 1500;

const DISPLAY_STATUS_USER = {
  id: '0',
  type: 'userTypeRegular',
} as ApiUser;

let cache: ObservedStore | undefined;
const lastWriteAtByUser = new Map<string, number>();

function loadStore(): ObservedStore {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) as ObservedStore : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function saveStore(store: ObservedStore) {
  cache = store;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private mode — keep in-memory only.
  }
}

function canTrackUser(accountId: string | undefined, userId: string) {
  if (!accountId || !userId || !isUserId(userId)) return false;
  if (userId === accountId) return false;
  if (userId === SERVICE_NOTIFICATIONS_USER_ID || userId === ANONYMOUS_USER_ID) return false;
  return getBygramSettings().isObservedLastSeenEnabled;
}

/** Record the latest moment this device saw the peer as active/online. */
export function recordObservedOnline(
  accountId: string | undefined,
  userId: string,
  atMs = Date.now(),
) {
  if (!canTrackUser(accountId, userId) || atMs <= 0) return;

  const throttleKey = `${accountId}:${userId}`;
  const lastWrite = lastWriteAtByUser.get(throttleKey) || 0;
  const store = loadStore();
  const accountMap = store[accountId!] || {};
  const previous = accountMap[userId] || 0;

  if (atMs <= previous) return;
  if (atMs - lastWrite < WRITE_THROTTLE_MS && atMs - previous < WRITE_THROTTLE_MS) return;

  accountMap[userId] = atMs;
  store[accountId!] = accountMap;
  lastWriteAtByUser.set(throttleKey, Date.now());
  saveStore(store);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: { accountId, userId, at: atMs },
  }));
}

export function getObservedOnlineAt(accountId: string | undefined, userId: string) {
  if (!accountId || !userId) return undefined;
  return loadStore()[accountId]?.[userId];
}

export function subscribeObservedOnline(listener: NoneToVoidFunction) {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

function formatObservedOnlineStatus(lang: OldLangFn, atMs: number) {
  // Reuse Telegram's own "last seen …" formatting with a synthetic offline status.
  return getUserStatus(lang, DISPLAY_STATUS_USER, {
    type: 'userStatusOffline',
    wasOnline: Math.floor(atMs / 1000),
  });
}

/**
 * Prefer Telegram's exact offline timestamp when available; otherwise, if privacy
 * only shows "recently"/week/month and we locally observed activity, show that time.
 */
export function getBygramDisplayUserStatus(
  lang: OldLangFn,
  user: ApiUser,
  userStatus: ApiUserStatus | undefined,
  accountId?: string,
) {
  const official = getUserStatus(lang, user, userStatus);

  if (!getBygramSettings().isObservedLastSeenEnabled || !accountId) {
    return official;
  }

  if (!userStatus) {
    return official;
  }

  if (userStatus.type === 'userStatusOnline') {
    return official;
  }

  if (userStatus.type === 'userStatusOffline' && userStatus.wasOnline) {
    return official;
  }

  const fuzzyTypes = new Set([
    'userStatusRecently',
    'userStatusLastWeek',
    'userStatusLastMonth',
    'userStatusEmpty',
    'userStatusOffline',
  ]);

  if (!fuzzyTypes.has(userStatus.type)) {
    return official;
  }

  const observedAt = getObservedOnlineAt(accountId, user.id);
  if (!observedAt) {
    return official;
  }

  return formatObservedOnlineStatus(lang, observedAt);
}
