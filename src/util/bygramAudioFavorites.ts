import type { ApiMessage } from '../api/types';

import { getMessageContent } from '../global/helpers';

export type BygramAudioFavorite = {
  key: string;
  accountId: string;
  chatId: string;
  messageId: number;
  title: string;
  performer?: string;
  likedAt: number;
};

const STORAGE_KEY = 'bygram-audio-favorites-v1';
const CHANGE_EVENT = 'bygram-audio-favorites-change';

export function isBygramAudioFavorite(accountId: string, chatId: string, messageId: number) {
  return Boolean(loadFavorites()[getFavoriteKey(accountId, chatId, messageId)]);
}

export function toggleBygramAudioFavorite(accountId: string, message: ApiMessage) {
  const favorites = loadFavorites();
  const key = getFavoriteKey(accountId, message.chatId, message.id);
  const isLiked = !favorites[key];

  if (isLiked) {
    const { audio } = getMessageContent(message);
    favorites[key] = {
      key,
      accountId,
      chatId: message.chatId,
      messageId: message.id,
      title: audio?.title || audio?.fileName || 'Аудиозапись',
      performer: audio?.performer,
      likedAt: Date.now(),
    };
  } else {
    delete favorites[key];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    return !isLiked;
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key, isLiked } }));
  return isLiked;
}

export function subscribeBygramAudioFavorites(listener: NoneToVoidFunction) {
  const handleChange = () => listener();
  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

function getFavoriteKey(accountId: string, chatId: string, messageId: number) {
  return `${accountId}:${chatId}:${messageId}`;
}

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, BygramAudioFavorite>;
  } catch {
    return {};
  }
}
