import { describe, expect, it } from 'vitest';

import type { ByProtoEnvelope } from './types';

import { buildMessageTextContent } from '../api/gramjs/apiBuilders/messageContent';
import { ByProtoCodec } from './codec';
import { parseByProtoMessage } from './parser';

function createEnvelope(): ByProtoEnvelope {
  return {
    v: 1,
    type: 'emoji.message',
    id: 'packet_roundtrip_01',
    ts: Math.floor(Date.now() / 1000),
    payload: {
      ranges: [
        { start: 0, length: 2, emojiAssetId: '5922558454332916696' },
        { start: 9, length: 2, emojiAssetId: '5801108895304779062' },
      ],
    },
  };
}

describe('ByProtoCodec', () => {
  it('survives the Telegram text builder round trip without changing visible text', () => {
    const visibleText = '😎 hello ❤️';
    const transportText = `${visibleText}${ByProtoCodec.encode(createEnvelope())}`;
    const copiedTransport = JSON.parse(JSON.stringify(transportText)) as string;
    const built = buildMessageTextContent(copiedTransport);
    const parsed = parseByProtoMessage(copiedTransport);

    expect(built.text).toBe(visibleText);
    expect(parsed.text).toBe(visibleText);
    expect(parsed.envelope).toEqual(createEnvelope());
  });

  it('ignores a damaged checksum and still strips the carrier from UI text', () => {
    const visibleText = 'Обычное сообщение';
    const encoded = ByProtoCodec.encode(createEnvelope());
    const index = 12;
    const replacement = encoded[index] === '\u200B' ? '\u200C' : '\u200B';
    const damaged = `${visibleText}${encoded.slice(0, index)}${replacement}${encoded.slice(index + 1)}`;

    expect(ByProtoCodec.decode(damaged)).toBeUndefined();
    expect(ByProtoCodec.strip(damaged)).toBe(visibleText);
    expect(parseByProtoMessage(damaged)).toEqual({ text: visibleText });
  });

  it('uses a cheap negative path for ordinary Telegram messages', () => {
    const text = 'Привет! Здесь нет служебных данных.';
    expect(ByProtoCodec.hasPayload(text)).toBe(false);
    expect(ByProtoCodec.decode(text)).toBeUndefined();
    expect(ByProtoCodec.strip(text)).toBe(text);
  });
});
