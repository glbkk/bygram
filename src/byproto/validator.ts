import {
  BYPROTO_BUBBLE_PRESETS,
  BYPROTO_FEATURES,
  BYPROTO_MAX_EMOJI_RANGES,
  BYPROTO_MAX_PACKET_BYTES,
  BYPROTO_VERSION,
  type ByProtoBubblePreset,
  type ByProtoEnvelope,
  type ByProtoFeature,
  type ValidByProtoEnvelope,
} from './types';

const PACKET_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const EMOJI_ASSET_ID_PATTERN = /^[0-9]{1,32}$/;
const COLOR_PATTERN = /^#[0-9A-F]{6}$/i;
const MAX_TEXT_OFFSET = 4096;
const MAX_REVISION = 2 ** 31 - 1;
const MAX_FUTURE_SECONDS = 10 * 60;
const MAX_AGE_SECONDS = 366 * 24 * 60 * 60;

const bubblePresets = new Set<string>(BYPROTO_BUBBLE_PRESETS);
const features = new Set<string>(BYPROTO_FEATURES);

export function validateByProtoEnvelope(value: unknown, encodedSize?: number): ValidByProtoEnvelope | undefined {
  if (!isRecord(value) || (encodedSize !== undefined && encodedSize > BYPROTO_MAX_PACKET_BYTES)) return undefined;
  if (value.v !== BYPROTO_VERSION || typeof value.type !== 'string') return undefined;
  if (typeof value.id !== 'string' || !PACKET_ID_PATTERN.test(value.id)) return undefined;
  if (!isSafeInteger(value.ts)) return undefined;

  const now = Math.floor(Date.now() / 1000);
  if (value.ts > now + MAX_FUTURE_SECONDS || value.ts < now - MAX_AGE_SECONDS) return undefined;

  const envelope = value as ByProtoEnvelope;
  switch (envelope.type) {
    case 'emoji.message':
      return validateEmojiMessage(envelope);
    case 'profile.update':
      return validateProfileUpdate(envelope);
    case 'profile.banner':
      return validateProfileBanner(envelope);
    case 'client.capabilities':
      return validateCapabilities(envelope);
    default:
      return undefined;
  }
}

function validateEmojiMessage(envelope: ByProtoEnvelope): ValidByProtoEnvelope | undefined {
  if (!isRecord(envelope.payload) || !Array.isArray(envelope.payload.ranges)) return undefined;
  if (!envelope.payload.ranges.length || envelope.payload.ranges.length > BYPROTO_MAX_EMOJI_RANGES) return undefined;

  let previousEnd = 0;
  for (const range of envelope.payload.ranges) {
    if (!isRecord(range) || !isSafeInteger(range.start) || !isSafeInteger(range.length)) return undefined;
    if (range.start < previousEnd || range.length < 1 || range.start + range.length > MAX_TEXT_OFFSET) return undefined;
    if (typeof range.emojiAssetId !== 'string' || !EMOJI_ASSET_ID_PATTERN.test(range.emojiAssetId)) return undefined;
    previousEnd = range.start + range.length;
  }
  return envelope as ValidByProtoEnvelope;
}

function validateProfileUpdate(envelope: ByProtoEnvelope): ValidByProtoEnvelope | undefined {
  const payload = envelope.payload;
  if (!isRecord(payload) || !isRevision(payload.revision)) return undefined;
  if (payload.bubblePreset !== undefined
    && (typeof payload.bubblePreset !== 'string' || !bubblePresets.has(payload.bubblePreset))) return undefined;
  if (payload.bubbleParams !== undefined && !validateBubbleParams(payload.bubbleParams)) return undefined;
  if (payload.bubbleParams !== undefined && payload.bubblePreset !== 'custom') return undefined;
  if (payload.bannerRevision !== undefined && !isRevision(payload.bannerRevision)) return undefined;
  if (payload.statusEmoji !== undefined
    && (typeof payload.statusEmoji !== 'string' || !EMOJI_ASSET_ID_PATTERN.test(payload.statusEmoji))) {
    return undefined;
  }
  return envelope as ValidByProtoEnvelope;
}

function validateBubbleParams(value: unknown) {
  if (!isRecord(value)) return false;
  if (typeof value.colorStart !== 'string' || !COLOR_PATTERN.test(value.colorStart)) return false;
  if (typeof value.colorEnd !== 'string' || !COLOR_PATTERN.test(value.colorEnd)) return false;
  if (typeof value.gradient !== 'boolean') return false;
  return value.decorationEmojiId === undefined
    || (typeof value.decorationEmojiId === 'string' && EMOJI_ASSET_ID_PATTERN.test(value.decorationEmojiId));
}

function validateProfileBanner(envelope: ByProtoEnvelope): ValidByProtoEnvelope | undefined {
  const payload = envelope.payload;
  if (!isRecord(payload) || !isRevision(payload.revision)) return undefined;
  if (payload.mediaMessageId !== undefined && (!isSafeInteger(payload.mediaMessageId) || payload.mediaMessageId < 0)) {
    return undefined;
  }
  return envelope as ValidByProtoEnvelope;
}

function validateCapabilities(envelope: ByProtoEnvelope): ValidByProtoEnvelope | undefined {
  const payload = envelope.payload;
  if (!isRecord(payload) || payload.protocol !== BYPROTO_VERSION || !Array.isArray(payload.features)) return undefined;
  if (payload.features.length > BYPROTO_FEATURES.length) return undefined;
  if (!payload.features.every((feature) => typeof feature === 'string' && features.has(feature))) return undefined;
  return envelope as ValidByProtoEnvelope;
}

export function isByProtoBubblePreset(value: unknown): value is ByProtoBubblePreset {
  return typeof value === 'string' && bubblePresets.has(value);
}

export function isByProtoFeature(value: unknown): value is ByProtoFeature {
  return typeof value === 'string' && features.has(value);
}

function isRevision(value: unknown) {
  return isSafeInteger(value) && value >= 0 && value <= MAX_REVISION;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
