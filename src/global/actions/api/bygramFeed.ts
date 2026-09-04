import type { ApiChat, ApiMessage } from '../../../api/types';
import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getBygramSettings } from '../../../util/bygramArchive';
import {
  BYGRAM_FEED_MAX_PER_CHANNEL,
  collectUnreadChannelIds,
  getChannelUnreadState,
} from '../../../util/bygramChannelFeed';
import { buildCollectionByKey } from '../../../util/iteratees';
import { isLocalMessageId } from '../../../util/keys/messageKey';
import { throttle } from '../../../util/schedulers';
import { callApi } from '../../../api/gramjs';
import { selectChat, selectIsCurrentUserFrozen } from '../../selectors';
import { selectThreadReadState } from '../../selectors/threads';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addChats,
  addMessages,
  addUsers,
  updateListedIds,
} from '../../reducers';
import { replaceThreadReadStateParam } from '../../reducers/threads';

const FEED_FETCH_CONCURRENCY = 4;
const pendingFeedMaxIdByChat: Record<string, number> = {};

const flushFeedReadMarks = throttle(() => {
  const entries = Object.entries(pendingFeedMaxIdByChat);
  if (!entries.length) return;

  Object.keys(pendingFeedMaxIdByChat).forEach((chatId) => {
    delete pendingFeedMaxIdByChat[chatId];
  });

  let global = getGlobal();
  if (getBygramSettings().isGhostModeEnabled || selectIsCurrentUserFrozen(global)) {
    return;
  }

  entries.forEach(([chatId, maxId]) => {
    const chat = selectChat(global, chatId);
    if (!chat || isLocalMessageId(maxId)) return;

    const readState = selectThreadReadState(global, chatId, MAIN_THREAD_ID);
    const lastReadId = readState?.lastReadInboxMessageId || 0;
    if (maxId <= lastReadId) return;

    void callApi('markMessageListRead', {
      chat,
      threadId: MAIN_THREAD_ID,
      maxId,
    });

    const byId = global.messages.byChatId[chatId]?.byId;
    let readCount = 0;
    if (byId) {
      Object.values(byId).forEach((message) => {
        if (!message || message.isOutgoing || message.content.action) return;
        if (message.id > lastReadId && message.id <= maxId) {
          readCount += 1;
        }
      });
    }

    const previousUnread = readState?.unreadCount || 0;
    const nextUnread = Math.max(0, previousUnread - Math.max(readCount, 1));
    global = replaceThreadReadStateParam(global, chatId, MAIN_THREAD_ID, 'lastReadInboxMessageId', maxId);
    global = replaceThreadReadStateParam(global, chatId, MAIN_THREAD_ID, 'unreadCount', nextUnread);
  });

  setGlobal(global);
}, 350, false);

async function fetchUnreadMessagesForChannel(
  chat: ApiChat,
  lastReadId: number,
  unreadCount: number,
): Promise<{ messages: ApiMessage[]; users?: any[]; chats?: any[] }> {
  const target = Math.min(Math.max(unreadCount, 1), BYGRAM_FEED_MAX_PER_CHANNEL);
  const collected: ApiMessage[] = [];
  let users: any[] = [];
  let chats: any[] = [];
  let offsetId: number | undefined;
  let remaining = target;

  while (remaining > 0) {
    const limit = Math.min(remaining + 5, 100);
    const result = await callApi('fetchMessages', {
      chat,
      threadId: MAIN_THREAD_ID,
      offsetId,
      addOffset: 0,
      limit,
    });

    if (!result?.messages?.length) {
      break;
    }

    collected.push(...result.messages);
    if (result.users?.length) users = users.concat(result.users);
    if (result.chats?.length) chats = chats.concat(result.chats);

    const oldestId = Math.min(...result.messages.map((message) => message.id));
    if (oldestId <= lastReadId || result.messages.length < limit) {
      break;
    }

    offsetId = oldestId;
    remaining -= result.messages.length;
  }

  return { messages: collected, users, chats };
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
}

addActionHandler('loadBygramChannelFeed', async (global): Promise<void> => {
  const channelIds = collectUnreadChannelIds(global);
  if (!channelIds.length) return;

  await mapPool(channelIds, FEED_FETCH_CONCURRENCY, async (chatId) => {
    let currentGlobal = getGlobal();
    const chat = selectChat(currentGlobal, chatId);
    if (!chat) return;

    const { unreadCount, lastReadInboxMessageId } = getChannelUnreadState(currentGlobal, chatId);
    if (unreadCount <= 0) return;

    const { messages, users, chats } = await fetchUnreadMessagesForChannel(
      chat,
      lastReadInboxMessageId,
      unreadCount,
    );
    if (!messages.length) return;

    currentGlobal = getGlobal();
    if (users?.length) {
      currentGlobal = addUsers(currentGlobal, buildCollectionByKey(users, 'id'));
    }
    if (chats?.length) {
      currentGlobal = addChats(currentGlobal, buildCollectionByKey(chats, 'id'));
    }
    currentGlobal = addMessages(currentGlobal, messages);

    const ids = messages.map((message) => message.id).sort((a, b) => a - b);
    currentGlobal = updateListedIds(currentGlobal, chatId, MAIN_THREAD_ID, ids);
    setGlobal(currentGlobal);
  });
});

addActionHandler('markBygramFeedMessageRead', (global, actions, payload): ActionReturnType => {
  if (selectIsCurrentUserFrozen(global)) return undefined;
  if (getBygramSettings().isGhostModeEnabled) return undefined;

  const { chatId, messageId } = payload;
  if (!chatId || !messageId || isLocalMessageId(messageId)) return undefined;

  const chat = selectChat(global, chatId);
  if (!chat) return undefined;

  const readState = selectThreadReadState(global, chatId, MAIN_THREAD_ID);
  const lastReadId = readState?.lastReadInboxMessageId || 0;
  if (messageId <= lastReadId) return undefined;

  const pending = pendingFeedMaxIdByChat[chatId] || 0;
  pendingFeedMaxIdByChat[chatId] = Math.max(pending, messageId);
  flushFeedReadMarks();

  return undefined;
});
