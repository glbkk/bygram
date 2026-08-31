import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ApiMessage, ApiMessageEntity, ApiSticker } from '../api/types';
import { ApiMessageEntityTypes } from '../api/types';

let initialGlobalState: typeof import('../global/initialState').INITIAL_GLOBAL_STATE;
let setTestGlobal: typeof import('../global').setGlobal;
let applyPremiumSend: typeof import('../util/bygramPremium').applyBygramPremiumSend;
let bindOverlay: typeof import('../util/bygramPremium').bindPremiumOverlayToMessage;
let withOverlay: typeof import('../util/bygramPremium').withPremiumEmojiOverlay;
let registerIncomingOverlay: typeof import('../util/bygramPremium').registerByProtoPremiumOverlay;
let getTestGlobal: typeof import('../global').getGlobal;

const PAID_EMOJI_ID = '5922558454332916696';
const FREE_EMOJI_ID = '5922558454332916697';

function setTestState(customEmojis: Record<string, ApiSticker> = {}, messages?: Record<number, ApiMessage>) {
  setTestGlobal({
    ...initialGlobalState,
    currentUserId: '1001',
    customEmojis: {
      ...initialGlobalState.customEmojis,
      byId: customEmojis,
    },
    messages: {
      ...initialGlobalState.messages,
      byChatId: messages ? { 2002: { byId: messages, threadsById: {} } } : {},
    },
  });
}

function buildCustomEmoji(id: string, isFree: boolean) {
  return { mediaType: 'sticker', id, isCustomEmoji: true, isFree } as ApiSticker;
}

describe('ByProto Premium Emoji fallback', () => {
  beforeAll(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });
    Object.defineProperty(globalThis.CSS, 'supports', {
      configurable: true,
      value: () => false,
    });
    const [initialStateModule, globalModule, premiumModule] = await Promise.all([
      import('../global/initialState'),
      import('../global'),
      import('../util/bygramPremium'),
    ]);
    initialGlobalState = initialStateModule.INITIAL_GLOBAL_STATE;
    setTestGlobal = globalModule.setGlobal;
    applyPremiumSend = premiumModule.applyBygramPremiumSend;
    bindOverlay = premiumModule.bindPremiumOverlayToMessage;
    withOverlay = premiumModule.withPremiumEmojiOverlay;
    registerIncomingOverlay = premiumModule.registerByProtoPremiumOverlay;
    getTestGlobal = globalModule.getGlobal;
  });

  beforeEach(() => {
    setTestState();
  });

  it('keeps the animated entity locally and removes it from the Telegram fallback', () => {
    const entities: ApiMessageEntity[] = [
      {
        type: ApiMessageEntityTypes.CustomEmoji,
        offset: 0,
        length: 2,
        documentId: '5922558454332916696',
      },
      {
        type: ApiMessageEntityTypes.Bold,
        offset: 3,
        length: 5,
      },
    ];

    const result = applyPremiumSend({
      chatId: '2002',
      text: '😎 hello',
      entities,
      hasTelegramPremium: false,
    });

    expect(result.entities).toEqual(entities);
    expect(result.networkEntities).toEqual([entities[1]]);
    expect(result.byProtoEmojiRanges).toEqual([{
      start: 0,
      length: 2,
      emojiAssetId: '5922558454332916696',
    }]);
  });

  it('uses native Telegram custom emoji unchanged for Premium accounts', () => {
    const entities: ApiMessageEntity[] = [{
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 0,
      length: 2,
      documentId: '5922558454332916696',
    }];

    expect(applyPremiumSend({
      chatId: '2002',
      text: '😎',
      entities,
      hasTelegramPremium: true,
    })).toEqual({ entities });
  });

  it('treats an already loaded paid emoji as paid', () => {
    setTestState({ [PAID_EMOJI_ID]: buildCustomEmoji(PAID_EMOJI_ID, false) });
    const entities: ApiMessageEntity[] = [{
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 0,
      length: 2,
      documentId: PAID_EMOJI_ID,
    }];

    const result = applyPremiumSend({
      chatId: '2002',
      text: '😎',
      entities,
      hasTelegramPremium: false,
    });

    expect(result.networkEntities).toEqual([]);
    expect(result.byProtoEmojiRanges).toHaveLength(1);
  });

  it('leaves an emoji that Telegram serves for free untouched', () => {
    setTestState({ [FREE_EMOJI_ID]: buildCustomEmoji(FREE_EMOJI_ID, true) });
    const entities: ApiMessageEntity[] = [{
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 0,
      length: 2,
      documentId: FREE_EMOJI_ID,
    }];

    expect(applyPremiumSend({
      chatId: '2002',
      text: '😎',
      entities,
      hasTelegramPremium: false,
    })).toEqual({ entities });
  });

  it('puts the paid emoji back on the message Telegram returns without it', () => {
    setTestState({ [PAID_EMOJI_ID]: buildCustomEmoji(PAID_EMOJI_ID, false) });
    applyPremiumSend({
      chatId: '2002',
      text: '😎',
      entities: [{
        type: ApiMessageEntityTypes.CustomEmoji,
        offset: 0,
        length: 2,
        documentId: PAID_EMOJI_ID,
      }],
      hasTelegramPremium: false,
    });

    const confirmedMessage = {
      id: 5000,
      chatId: '2002',
      date: Math.floor(Date.now() / 1000),
      isOutgoing: true,
      senderId: '1001',
      content: { text: { text: '😎' } },
    } as ApiMessage;

    bindOverlay('2002', confirmedMessage, 100001);

    expect(withOverlay(confirmedMessage).content.text?.entities).toEqual([{
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 0,
      length: 2,
      documentId: PAID_EMOJI_ID,
    }]);
  });

  it('writes an incoming paid emoji into the message that is already on screen', () => {
    const incomingMessage = {
      id: 7000,
      chatId: '2002',
      date: Math.floor(Date.now() / 1000),
      isOutgoing: false,
      senderId: '2002',
      content: { text: { text: '😎' } },
    } as ApiMessage;
    setTestState({}, { 7000: incomingMessage });

    registerIncomingOverlay({
      packetId: 'packet-7000',
      chatId: '2002',
      senderUserId: '2002',
      messageId: 7000,
      text: '😎',
      createdAt: incomingMessage.date,
      entities: [{
        type: ApiMessageEntityTypes.CustomEmoji,
        offset: 0,
        length: 2,
        documentId: PAID_EMOJI_ID,
      }],
    });

    const stored = getTestGlobal().messages.byChatId['2002'].byId[7000];
    expect(stored.content.text?.entities).toEqual([{
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 0,
      length: 2,
      documentId: PAID_EMOJI_ID,
    }]);
  });
});
