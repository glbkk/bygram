import type { ChatListType } from '../types';

import { ACCOUNT_SLOT } from './multiaccount';

const STORAGE_KEY = `bygram-local-pins-${ACCOUNT_SLOT || 1}`;

type LocalPins = Partial<Record<ChatListType, string[]>>;

export function getBygramLocalPinnedIds(listType: ChatListType) {
  return readLocalPins()[listType] || [];
}

export function addBygramLocalPinnedId(listType: ChatListType, chatId: string) {
  const localPins = readLocalPins();
  localPins[listType] = [chatId, ...getBygramLocalPinnedIds(listType).filter((id) => id !== chatId)];
  writeLocalPins(localPins);
  return localPins[listType];
}

export function removeBygramLocalPinnedId(listType: ChatListType, chatId: string) {
  const localPins = readLocalPins();
  localPins[listType] = getBygramLocalPinnedIds(listType).filter((id) => id !== chatId);
  writeLocalPins(localPins);
  return localPins[listType];
}

export function mergeBygramLocalPinnedIds(listType: ChatListType, serverPinnedIds: string[] = []) {
  const localPinnedIds = getBygramLocalPinnedIds(listType);
  return [...localPinnedIds, ...serverPinnedIds.filter((id) => !localPinnedIds.includes(id))];
}

function readLocalPins(): LocalPins {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LocalPins;
  } catch {
    return {};
  }
}

function writeLocalPins(localPins: LocalPins) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localPins));
}
