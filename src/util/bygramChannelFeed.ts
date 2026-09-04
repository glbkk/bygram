import type { ApiChat, ApiMessage } from '../api/types';
import { MAIN_THREAD_ID } from '../api/types';

import { isChatChannel } from '../global/helpers';
import { selectThreadReadState } from '../global/selectors/threads';
import type { GlobalState } from '../global/types';

export const BYGRAM_FEED_CHAT_ID = 'bygram-feed';
export const BYGRAM_FEED_MAX_CHANNELS = 80;
export const BYGRAM_FEED_MAX_PER_CHANNEL = 100;
export const BYGRAM_FEED_MESSAGE_LIMIT = 200;

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

/** Unread channel posts already present in local message store, newest first. */
export function collectBygramFeedMessages(global: GlobalState, limit = BYGRAM_FEED_MESSAGE_LIMIT): ApiMessage[] {
  const result: ApiMessage[] = [];

  Object.values(global.chats.byId).forEach((chat) => {
    if (!chat || isBygramFeedChatId(chat.id) || !isChatChannel(chat) || chat.isNotJoined || chat.isForbidden) {
      return;
    }

    const { unreadCount, lastReadInboxMessageId } = getChannelUnreadState(global, chat.id);
    if (unreadCount <= 0) return;

    const byId = global.messages.byChatId[chat.id]?.byId;
    if (!byId) return;

    Object.values(byId).forEach((message) => {
      if (!message || message.isOutgoing) return;
      if (message.id <= lastReadInboxMessageId) return;
      if (message.content.action) return;
      result.push(message);
    });
  });

  return result
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
