import { indexedDB as fakeIndexedDb } from 'fake-indexeddb';
import { beforeAll, describe, expect, it } from 'vitest';

import { ByProtoStore } from './store';

describe('ByProtoStore', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: fakeIndexedDb, configurable: true });
  });

  it('persists protocol peer state and replay ids in separate stores', async () => {
    const peerId = '123456789';
    await ByProtoStore.setPeerCapabilities({
      peerId,
      protocol: 1,
      features: ['bubble-profile', 'custom-emoji'],
      updatedAt: 10,
    });
    await ByProtoStore.setPeerProfile({
      peerId,
      revision: 4,
      bubblePreset: 'violet',
      updatedAt: 11,
    });
    await ByProtoStore.setPeerBubble({
      peerId,
      revision: 4,
      presetId: 'violet',
      updatedAt: 11,
    });
    await ByProtoStore.setPeerBanner({
      peerId,
      revision: 2,
      messageId: 77,
      mimeType: 'image/jpeg',
      updatedAt: 12,
    });
    await ByProtoStore.markPacketProcessed('packet_store_test_01');
    await ByProtoStore.setProtocolState('last-test', { ok: true });

    expect(await ByProtoStore.getPeerCapabilities(peerId)).toMatchObject({ protocol: 1 });
    expect(await ByProtoStore.getPeerProfile(peerId)).toMatchObject({ revision: 4 });
    expect(await ByProtoStore.getPeerBubble(peerId)).toMatchObject({ presetId: 'violet' });
    expect(await ByProtoStore.getPeerBanner(peerId)).toMatchObject({ messageId: 77 });
    expect(await ByProtoStore.hasProcessedPacket('packet_store_test_01')).toBe(true);
    expect(await ByProtoStore.getProtocolState('last-test')).toEqual({ ok: true });
  });
});
