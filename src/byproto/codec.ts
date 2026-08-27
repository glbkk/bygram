import type { ByProtoEnvelope } from './types';
import { BYPROTO_MAX_PACKET_BYTES } from './types';

const PREFIX = '\u2063\u2060\u2063\u2062';
const SUFFIX = '\u2064\u2063\u2060\u2064';
const ALPHABET = ['\u200B', '\u200C', '\u200D', '\u2060'] as const;
const HEADER_SIZE = 2;
const CHECKSUM_SIZE = 4;
const MIN_FRAME_SIZE = HEADER_SIZE + CHECKSUM_SIZE + 2;

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export const ByProtoCodec = {
  encode(envelope: ByProtoEnvelope) {
    const payload = encoder.encode(JSON.stringify(envelope));
    if (payload.byteLength > BYPROTO_MAX_PACKET_BYTES) throw new Error('BYPROTO_PACKET_TOO_LARGE');

    const frame = new Uint8Array(HEADER_SIZE + payload.byteLength + CHECKSUM_SIZE);
    const view = new DataView(frame.buffer);
    view.setUint16(0, payload.byteLength);
    frame.set(payload, HEADER_SIZE);
    view.setUint32(HEADER_SIZE + payload.byteLength, crc32(payload));

    let encoded = PREFIX;
    for (const byte of frame) {
      encoded += ALPHABET[(byte >> 6) & 3];
      encoded += ALPHABET[(byte >> 4) & 3];
      encoded += ALPHABET[(byte >> 2) & 3];
      encoded += ALPHABET[byte & 3];
    }
    return `${encoded}${SUFFIX}`;
  },

  decode(messageText: string): ByProtoEnvelope | undefined {
    const carrier = getCarrier(messageText);
    if (!carrier || carrier.length % 4 !== 0) return undefined;

    const frame = new Uint8Array(carrier.length / 4);
    for (let i = 0; i < frame.length; i++) {
      let byte = 0;
      for (let part = 0; part < 4; part++) {
        const value = ALPHABET.indexOf(carrier[i * 4 + part] as typeof ALPHABET[number]);
        if (value < 0) return undefined;
        byte = (byte << 2) | value;
      }
      frame[i] = byte;
    }
    if (frame.length < MIN_FRAME_SIZE) return undefined;

    const view = new DataView(frame.buffer);
    const size = view.getUint16(0);
    if (size > BYPROTO_MAX_PACKET_BYTES || frame.length !== HEADER_SIZE + size + CHECKSUM_SIZE) return undefined;
    const payload = frame.slice(HEADER_SIZE, HEADER_SIZE + size);
    if (view.getUint32(HEADER_SIZE + size) !== crc32(payload)) return undefined;

    try {
      return JSON.parse(decoder.decode(payload)) as ByProtoEnvelope;
    } catch {
      return undefined;
    }
  },

  strip(messageText: string) {
    const start = getCarrierStart(messageText);
    return start === -1 ? messageText : messageText.slice(0, start);
  },

  hasPayload(messageText: string) {
    return getCarrierStart(messageText) !== -1;
  },
};

function getCarrier(messageText: string) {
  const start = getCarrierStart(messageText);
  return start === -1 ? undefined : messageText.slice(start + PREFIX.length, -SUFFIX.length);
}

function getCarrierStart(messageText: string) {
  if (messageText.length < PREFIX.length + SUFFIX.length || !messageText.endsWith(SUFFIX)) return -1;
  return messageText.lastIndexOf(PREFIX);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
