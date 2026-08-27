import { getGlobal } from '../global';

import type {
  ByProtoEmojiRange,
  ByProtoEnvelope,
  ByProtoProfileBannerEnvelope,
  ByProtoProfileUpdateEnvelope,
  ValidByProtoEnvelope,
} from './types';
import { BYPROTO_VERSION } from './types';

import { getBygramSettings } from '../util/bygramArchive';
import { LOCAL_BYPROTO_CAPABILITIES } from './capabilities';
import { ByProtoCodec } from './codec';
import { isByProtoBubblePreset, validateByProtoEnvelope } from './validator';

type LocalProfileState = {
  fingerprint: string;
  revision: number;
  bubblePreset: string;
  bubbleParams?: {
    colorStart: string;
    colorEnd: string;
    gradient: boolean;
    decorationEmojiId?: string;
  };
  statusEmoji?: string;
};

type PeerSendState = {
  capabilitiesAt?: number;
  profileRevision?: number;
  profileAt?: number;
};

type SendState = Record<string, PeerSendState>;

const LOCAL_PROFILE_KEY = 'byproto-local-profile-v1';
const SEND_STATE_KEY = 'byproto-send-state-v1';
const STATUS_EMOJI_KEY = 'byproto-status-emoji-v1';
const CAPABILITY_INTERVAL_SECONDS = 30 * 24 * 60 * 60;
const PROFILE_INTERVAL_SECONDS = 7 * 24 * 60 * 60;
const TELEGRAM_MESSAGE_LIMIT = 4096;

export function prepareByProtoOutgoingText(params: {
  peerKey: string;
  visibleText?: string;
  emojiRanges?: ByProtoEmojiRange[];
  explicitEnvelope?: ValidByProtoEnvelope;
}) {
  const visibleText = params.visibleText || '';
  if (!visibleText || !getBygramSettings().isByProtoEnabled) return undefined;

  let envelope = params.explicitEnvelope || buildEmojiEnvelope(params.emojiRanges);
  let commitControlEnvelope: (() => void) | undefined;
  if (!envelope) {
    const control = chooseControlEnvelope(params.peerKey);
    envelope = control?.envelope;
    commitControlEnvelope = control?.commit;
  }
  if (!envelope) return undefined;

  const validated = validateByProtoEnvelope(envelope);
  if (!validated) return undefined;

  try {
    const carrier = ByProtoCodec.encode(validated);
    if (visibleText.length + carrier.length > TELEGRAM_MESSAGE_LIMIT) return undefined;
    commitControlEnvelope?.();
    return `${visibleText}${carrier}`;
  } catch {
    return undefined;
  }
}

export function createByProtoProfileBannerEnvelope(revision: number): ByProtoProfileBannerEnvelope {
  return createEnvelope('profile.banner', { revision, mediaMessageId: 0 }) as ByProtoProfileBannerEnvelope;
}

export function createByProtoProfileUpdateEnvelope(): ByProtoProfileUpdateEnvelope {
  const profile = getLocalProfile();
  return createEnvelope('profile.update', {
    revision: profile.revision,
    bubblePreset: profile.bubblePreset,
    bubbleParams: profile.bubbleParams,
    statusEmoji: profile.statusEmoji,
  }) as ByProtoProfileUpdateEnvelope;
}

export function createByProtoEnvelope(type: string, payload: unknown): ByProtoEnvelope {
  return createEnvelope(type, payload);
}

export function getLocalByProtoStatusEmoji() {
  return readJson<string>(accountKey(STATUS_EMOJI_KEY));
}

export function setLocalByProtoStatusEmoji(documentId?: string) {
  const key = accountKey(STATUS_EMOJI_KEY);
  try {
    if (documentId) localStorage.setItem(key, JSON.stringify(documentId));
    else localStorage.removeItem(key);
  } catch {
    // Status synchronization is optional when persistent storage is unavailable.
  }
}

function buildEmojiEnvelope(ranges?: ByProtoEmojiRange[]) {
  if (!ranges?.length) return undefined;
  return createEnvelope('emoji.message', { ranges });
}

function chooseControlEnvelope(peerKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const state = loadSendState();
  const peerState = state[peerKey] || {};
  const profile = getLocalProfile();
  if (peerState.profileRevision !== profile.revision
    || !peerState.profileAt
    || now - peerState.profileAt >= PROFILE_INTERVAL_SECONDS) {
    return {
      envelope: createEnvelope('profile.update', {
        revision: profile.revision,
        bubblePreset: profile.bubblePreset,
        bubbleParams: profile.bubbleParams,
        statusEmoji: profile.statusEmoji,
      }),
      commit: () => {
        peerState.profileRevision = profile.revision;
        peerState.profileAt = now;
        state[peerKey] = peerState;
        saveSendState(state);
      },
    };
  }
  if (!peerState.capabilitiesAt || now - peerState.capabilitiesAt >= CAPABILITY_INTERVAL_SECONDS) {
    return {
      envelope: createEnvelope('client.capabilities', LOCAL_BYPROTO_CAPABILITIES),
      commit: () => {
        peerState.capabilitiesAt = now;
        state[peerKey] = peerState;
        saveSendState(state);
      },
    };
  }
  return undefined;
}

function getLocalProfile(): LocalProfileState {
  const settings = getBygramSettings();
  const bubblePreset = isByProtoBubblePreset(settings.messageBubbleStyle)
    ? settings.messageBubbleStyle
    : 'default';
  const bubbleParams = bubblePreset === 'custom' ? {
    colorStart: normalizeColor(settings.messageBubbleColor),
    colorEnd: normalizeColor(settings.messageBubbleColorEnd),
    gradient: settings.isMessageBubbleGradientEnabled,
    decorationEmojiId: normalizeDocumentId(settings.messageBubbleCustomEmojiId),
  } : undefined;
  const statusEmoji = getLocalByProtoStatusEmoji();
  const fingerprint = JSON.stringify({ bubblePreset, bubbleParams, statusEmoji });
  const key = accountKey(LOCAL_PROFILE_KEY);
  const stored = readJson<LocalProfileState>(key);
  if (stored?.fingerprint === fingerprint) return stored;

  const next = {
    fingerprint,
    revision: Math.max(1, (stored?.revision || 0) + 1),
    bubblePreset,
    bubbleParams,
    statusEmoji,
  };
  writeJson(key, next);
  return next;
}

function createEnvelope(type: string, payload: unknown): ByProtoEnvelope {
  return {
    v: BYPROTO_VERSION,
    type,
    id: typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    ts: Math.floor(Date.now() / 1000),
    payload,
  };
}

function loadSendState() {
  return readJson<SendState>(accountKey(SEND_STATE_KEY)) || {};
}

function saveSendState(state: SendState) {
  writeJson(accountKey(SEND_STATE_KEY), state);
}

function accountKey(key: string) {
  return `${key}:${getGlobal().currentUserId || 'local'}`;
}

function readJson<T>(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing may reject persistent storage; the message still sends normally.
  }
}

function normalizeColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value) ? value.toUpperCase() : '#7C5CFC';
}

function normalizeDocumentId(value?: string) {
  return value && /^[0-9]{1,32}$/.test(value) ? value : undefined;
}
