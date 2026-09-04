import type { ApiChat, ApiMessage } from '../api/types';

import { isChatChannel } from '../global/helpers';
import type { GlobalState } from '../global/types';

export const BYGRAM_FEED_CHAT_ID = 'bygram-feed';

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

/** Unread channel posts already present in local message store, newest first. */
export function collectBygramFeedMessages(global: GlobalState, limit = 80): ApiMessage[] {
  const result: ApiMessage[] = [];

  Object.values(global.chats.byId).forEach((chat) => {
    if (!chat || isBygramFeedChatId(chat.id) || !isChatChannel(chat) || chat.isNotJoined || chat.isForbidden) {
      return;
    }

    const unreadCount = chat.unreadCount || 0;
    if (unreadCount <= 0) return;

    const lastReadId = chat.lastReadInboxMessageId || 0;
    const byId = global.messages.byChatId[chat.id]?.byId;
    if (!byId) return;

    Object.values(byId).forEach((message) => {
      if (!message || message.isOutgoing) return;
      if (message.id <= lastReadId) return;
      if (message.content.action) return;
      result.push(message);
    });
  });

  return result
    .sort((a, b) => b.date - a.date || b.id - a.id)
    .slice(0, limit);
}

export function collectUnreadChannelIds(global: GlobalState, limit = 24): string[] {
  return Object.values(global.chats.byId)
    .filter((chat) => (
      chat
      && !isBygramFeedChatId(chat.id)
      && isChatChannel(chat)
      && !chat.isNotJoined
      && !chat.isForbidden
      && (chat.unreadCount || 0) > 0
    ))
    .sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
    .slice(0, limit)
    .map((chat) => chat.id);
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
    return sum + (chat.unreadCount || 0);
  }, 0);
}
