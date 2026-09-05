import type { ApiChat, ApiMessage } from '../api/types';
import { MAIN_THREAD_ID } from '../api/types';

import { isChatChannel } from '../global/helpers';
import { selectThreadReadState } from '../global/selectors/threads';
import type { GlobalState } from '../global/types';

export const BYGRAM_FEED_CHAT_ID = 'bygram-feed';
export const BYGRAM_FEED_MAX_CHANNELS = 80;
export const BYGRAM_FEED_MAX_PER_CHANNEL = 100;
export const BYGRAM_FEED_MESSAGE_LIMIT = 200;

type FeedMessageKey = string;

/** Messages kept visible for the current feed session even after mark-as-read. */
let sessionMessagesByKey = new Map<FeedMessageKey, ApiMessage>();
let sessionActive = false;

function messageKey(message: ApiMessage): FeedMessageKey {
  return `${message.chatId}:${message.id}`;
}

export function isBygramFeedChatId(chatId?: string) {
  return chatId === BYGRAM_FEED_CHAT_ID;
}

export function getBygramFeedChat(): ApiChat {
  return {
    id: BYGRAM_FEED_CHAT_ID,
    type: 'chatTypeChannel',
    title: 'Лента',
    isListed: true,
  };
}

export function getChannelUnreadState(global: GlobalState, chatId: string) {
  const readState = selectThreadReadState(global, chatId, MAIN_THREAD_ID);
  return {
    unreadCount: readState?.unreadCount || 0,
    lastReadInboxMessageId: readState?.lastReadInboxMessageId || 0,
  };
}

export function beginBygramFeedSession() {
  sessionActive = true;
  sessionMessagesByKey = new Map();
}

export function endBygramFeedSession() {
  sessionActive = false;
  sessionMessagesByKey = new Map();
}

export function isBygramFeedSessionActive() {
  return sessionActive;
}

export function rememberBygramFeedMessages(messages: ApiMessage[]) {
  if (!sessionActive) return;
  messages.forEach((message) => {
    sessionMessagesByKey.set(messageKey(message), message);
  });
}

export function collectUnreadChannelIds(global: GlobalState, limit = BYGRAM_FEED_MAX_CHANNELS): string[] {
  return Object.values(global.chats.byId)
    .filter((chat) => {
      if (
        !chat
        || isBygramFeedChatId(chat.id)
        || !isChatChannel(chat)
        || chat.isNotJoined
        || chat.isForbidden
      ) {
        return false;
      }
      return getChannelUnreadState(global, chat.id).unreadCount > 0;
    })
    .sort((a, b) => (
      getChannelUnreadState(global, b.id).unreadCount
      - getChannelUnreadState(global, a.id).unreadCount
    ))
    .slice(0, limit)
    .map((chat) => chat.id);
}

/** Unread channel posts (plus session-pinned ones while the feed is open), newest first. */
export function collectBygramFeedMessages(global: GlobalState, limit = BYGRAM_FEED_MESSAGE_LIMIT): ApiMessage[] {
  const byKey = new Map<FeedMessageKey, ApiMessage>();

  if (sessionActive) {
    sessionMessagesByKey.forEach((message, key) => {
      const fresh = global.messages.byChatId[message.chatId]?.byId?.[message.id] || message;
      byKey.set(key, fresh);
    });
  }

  Object.values(global.chats.byId).forEach((chat) => {
    if (!chat || isBygramFeedChatId(chat.id) || !isChatChannel(chat) || chat.isNotJoined || chat.isForbidden) {
      return;
    }

    const { unreadCount, lastReadInboxMessageId } = getChannelUnreadState(global, chat.id);
    if (unreadCount <= 0 && !sessionActive) return;

    const messagesById = global.messages.byChatId[chat.id]?.byId;
    if (!messagesById) return;

    Object.values(messagesById).forEach((message) => {
      if (!message || message.isOutgoing) return;
      if (message.content.action) return;

      const key = messageKey(message);
      if (sessionActive && sessionMessagesByKey.has(key)) {
        byKey.set(key, message);
        return;
      }

      if (message.id <= lastReadInboxMessageId) return;
      if (unreadCount <= 0) return;
      byKey.set(key, message);
      if (sessionActive) {
        sessionMessagesByKey.set(key, message);
      }
    });
  });

  return Array.from(byKey.values())
    .sort((a, b) => b.date - a.date || b.id - a.id)
    .slice(0, limit);
}

export function getBygramFeedUnreadCount(global: GlobalState) {
  return Object.values(global.chats.byId).reduce((sum, chat) => {
    if (
      !chat
      || isBygramFeedChatId(chat.id)
      || !isChatChannel(chat)
      || chat.isNotJoined
      || chat.isForbidden
    ) {
      return sum;
    }
    return sum + getChannelUnreadState(global, chat.id).unreadCount;
  }, 0);
}
