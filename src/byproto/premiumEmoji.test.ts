import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ApiMessageEntity } from '../api/types';
import { ApiMessageEntityTypes } from '../api/types';

let initialGlobalState: typeof import('../global/initialState').INITIAL_GLOBAL_STATE;
let setTestGlobal: typeof import('../global').setGlobal;
let applyPremiumSend: typeof import('../util/bygramPremium').applyBygramPremiumSend;

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
  });

  beforeEach(() => {
    const global = {
      ...initialGlobalState,
      currentUserId: '1001',
      customEmojis: {
        ...initialGlobalState.customEmojis,
        byId: {},
      },
    };
    setTestGlobal(global);
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
});
