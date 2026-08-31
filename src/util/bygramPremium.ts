import { getGlobal, setGlobal } from '../global';

import type { ApiMessage, ApiMessageEntity, ApiMessageEntityCustomEmoji } from '../api/types';
import type { ByProtoEmojiRange } from '../byproto/types';
import { ApiMessageEntityTypes } from '../api/types';

import { getEmojiOnlyCountForMessage } from '../global/helpers/getEmojiOnlyCountForMessage';
import { updateChatMessage } from '../global/reducers';
import { selectChatMessage, selectCustomEmoji } from '../global/selectors';
import { isUserId } from './entities/ids';
import { isLocalMessageId } from './keys/messageKey';
import { unique } from './iteratees';
import { ACCOUNT_SLOT } from './multiaccount';
import { getServerTime } from './serverTime';

type BygramProfile = {
  telegramUserId: string;
  bubbleStyle?: string;
  premiumEmojiStatusId?: string;
  createdAt: string;
  updatedAt: string;
};

type BygramPremiumEmojiMessage = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  documentId: string;
  createdAt: string;
  text?: string;
  offset?: number;
  length?: number;
  telegramMessageId?: number;
};

type ProfileListener = (userId: string, profile: BygramProfile | undefined) => void;
type ConversationListener = (pairId: string) => void;
type OverlayListener = (chatId: string) => void;

export type BygramChatOverlay = {
  id: string;
  chatId: string;
  senderUserId: string;
  text: string;
  entities: ApiMessageEntityCustomEmoji[];
  createdAt: number;
  messageId?: number;
  previousLocalId?: number;
};

const OVERLAY_MATCH_SECONDS = 45;
const OVERLAY_LIMIT = 200;
const OVERLAY_STORAGE_KEY = `bygram-premium-overlays-${ACCOUNT_SLOT || 1}`;

const profiles = new Map<string, BygramProfile>();
const missingProfiles = new Set<string>();
const profileInflight = new Map<string, Promise<BygramProfile | undefined>>();
const profileListeners = new Set<ProfileListener>();
const conversations = new Map<string, BygramPremiumEmojiMessage[]>();
const conversationListeners = new Set<ConversationListener>();
const knownBygramUsers = new Set<string>();
const overlaysByChat = new Map<string, BygramChatOverlay[]>();
const overlayListeners = new Set<OverlayListener>();

let didBindRealtime = false;
let didHydrateOverlays = false;

export function getCachedBygramProfile(userId: string) {
  return profiles.get(userId);
}

export function rememberBygramProfile(profile: BygramProfile) {
  profiles.set(profile.telegramUserId, profile);
  missingProfiles.delete(profile.telegramUserId);
  knownBygramUsers.add(profile.telegramUserId);
  profileListeners.forEach((listener) => listener(profile.telegramUserId, profile));
}

export function subscribeBygramProfiles(listener: ProfileListener) {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

export function ensureBygramProfile(userId: string) {
  if (!isUserId(userId) || missingProfiles.has(userId)) return Promise.resolve(undefined);
  const cached = profiles.get(userId);
  if (cached) return Promise.resolve(cached);
  const inflight = profileInflight.get(userId);
  if (inflight) return inflight;

  const request = import('../byproto/runtime')
    .then(({ ensureByProtoPeerLoaded }) => ensureByProtoPeerLoaded(userId))
    .then((snapshot) => {
      if (!snapshot.profile) return undefined;
      const profile: BygramProfile = {
        telegramUserId: userId,
        bubbleStyle: snapshot.profile.bubblePreset,
        premiumEmojiStatusId: snapshot.profile.statusEmoji,
        createdAt: new Date(snapshot.profile.updatedAt).toISOString(),
        updatedAt: new Date(snapshot.profile.updatedAt).toISOString(),
      };
      rememberBygramProfile(profile);
      return profile;
    })
    .catch(() => {
      missingProfiles.add(userId);
      return undefined;
    })
    .finally(() => profileInflight.delete(userId));
  profileInflight.set(userId, request);
  return request;
}

export function conversationKey(userId: string, peerId: string) {
  return [userId, peerId].sort().join(':');
}

export function getCachedPremiumConversation(userId: string, peerId: string) {
  return conversations.get(conversationKey(userId, peerId)) || [];
}

export function subscribePremiumConversations(listener: ConversationListener) {
  conversationListeners.add(listener);
  return () => conversationListeners.delete(listener);
}

export function subscribePremiumOverlays(listener: OverlayListener) {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
}

export function getChatPremiumOverlays(chatId: string) {
  hydrateOverlays();
  return (overlaysByChat.get(chatId) || []).slice();
}

export function registerByProtoPremiumOverlay(params: {
  packetId: string;
  chatId: string;
  senderUserId: string;
  messageId: number;
  text: string;
  entities: ApiMessageEntityCustomEmoji[];
  createdAt: number;
}) {
  hydrateOverlays();
  const list = overlaysByChat.get(params.chatId) || [];
  if (list.some((item) => item.id === params.packetId)) return;
  overlaysByChat.set(params.chatId, [...list, {
    id: params.packetId,
    chatId: params.chatId,
    senderUserId: params.senderUserId,
    text: params.text,
    entities: params.entities.map((entity) => ({ ...entity })),
    createdAt: params.createdAt,
    messageId: params.messageId,
  }].slice(-OVERLAY_LIMIT));
  persistOverlays();
  notifyOverlays(params.chatId);
  commitPremiumOverlayToMessage(params.chatId, params.messageId);
}

// The packet carrying the paid emoji is decoded only after the message has been stored and rendered,
// so the restored entities are written back into it. Leaving them in the overlay alone would keep
// the message untouched in the global state, and nothing would ask it to render again.
function commitPremiumOverlayToMessage(chatId: string, messageId: number) {
  let global = getGlobal();
  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return;

  const restored = withPremiumEmojiOverlay(message);
  if (restored === message) return;

  global = updateChatMessage(global, chatId, messageId, { content: restored.content });
  setGlobal(global);
}

function rememberConversation(pairId: string, messages: BygramPremiumEmojiMessage[]) {
  conversations.set(pairId, messages);
  conversationListeners.forEach((listener) => listener(pairId));
  messages.forEach(ingestServerOverlay);
}

export function rememberPremiumEmojiMessage(message: BygramPremiumEmojiMessage) {
  const pairId = conversationKey(message.senderUserId, message.recipientUserId);
  const current = conversations.get(pairId) || [];
  if (current.some((item) => item.id === message.id)) {
    ingestServerOverlay(message);
    return;
  }
  rememberConversation(pairId, [...current, message].slice(-OVERLAY_LIMIT));
}

export function loadPremiumConversation(userId: string, peerId: string) {
  bindBygramPremiumRealtime();
  return Promise.resolve(conversations.get(conversationKey(userId, peerId)) || []);
}

export function isKnownBygramUser(userId: string) {
  return knownBygramUsers.has(userId);
}

export function collectCustomEmojiIds(entities?: ApiMessageEntity[]) {
  return unique(collectCustomEmojiEntities(entities).map((entity) => entity.documentId));
}

export function isCustomEmojiOnlyMessage(text?: string, entities?: ApiMessageEntity[]) {
  if (!text || !entities?.length) return false;
  if (entities.some((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji)) return false;
  const covered = entities.reduce((sum, entity) => sum + entity.length, 0);
  return covered === text.length;
}

export function applyBygramPremiumSend(params: {
  chatId: string;
  text?: string;
  entities?: ApiMessageEntity[];
  hasTelegramPremium: boolean;
}): {
  entities?: ApiMessageEntity[];
  networkEntities?: ApiMessageEntity[];
  byProtoEmojiRanges?: ByProtoEmojiRange[];
} {
  const paidEntities = getPaidCustomEmojiEntities(params.entities);
  if (!paidEntities.length) {
    return { entities: params.entities };
  }

  if (params.hasTelegramPremium) {
    return { entities: params.entities };
  }

  registerOutgoingPremiumOverlay({
    chatId: params.chatId,
    text: params.text || '',
    entities: paidEntities,
  });

  return {
    entities: params.entities,
    networkEntities: params.entities?.filter((entity) => (
      entity.type !== ApiMessageEntityTypes.CustomEmoji
      || !paidEntities.some((paid) => paid.documentId === entity.documentId && paid.offset === entity.offset)
    )),
    byProtoEmojiRanges: [...paidEntities].sort((a, b) => a.offset - b.offset).map((entity) => ({
      start: entity.offset,
      length: entity.length,
      emojiAssetId: entity.documentId,
    })),
  };
}

export function bindPremiumOverlayToMessage(chatId: string, message: ApiMessage, localId?: number) {
  hydrateOverlays();
  const text = message.content.text?.text;
  const senderId = message.senderId || (message.isOutgoing ? getGlobal().currentUserId : chatId);
  if (!text || !senderId) return;

  const list = overlaysByChat.get(chatId);
  if (!list?.length) return;

  const overlay = list.find((item) => (
    item.messageId === message.id
    || (localId !== undefined && (item.messageId === localId || item.previousLocalId === localId))
    || item.previousLocalId === message.id
    || (
      item.senderUserId === senderId
      && (!item.text || item.text === text)
      && Math.abs(item.createdAt - message.date) <= OVERLAY_MATCH_SECONDS
      && (!item.messageId || isLocalMessageId(item.messageId) || item.messageId === message.id)
    )
  ));
  if (!overlay) return;

  const nextLocalId = localId
    ?? (isLocalMessageId(message.id) ? message.id : overlay.previousLocalId);
  const nextMessageId = isLocalMessageId(message.id) ? overlay.messageId || message.id : message.id;
  if (overlay.messageId === nextMessageId && overlay.previousLocalId === nextLocalId) return;

  overlay.previousLocalId = nextLocalId;
  overlay.messageId = nextMessageId;
  persistOverlays();
  notifyOverlays(chatId);
}

export function withPremiumEmojiOverlay(message: ApiMessage, overlays?: BygramChatOverlay[]): ApiMessage {
  const text = message.content.text;
  if (!text) return message;

  hydrateOverlays();
  const overlay = findOverlayForMessage(message, overlays || overlaysByChat.get(message.chatId));
  if (!overlay) return message;
  if (messageHasOverlayEntities(text, overlay)) return message;

  const overlayEntities = overlay.entities.map((entity) => (
    entity.length > 0 ? entity : {
      ...entity,
      offset: 0,
      length: text.text.length,
    }
  )).filter((entity) => (
    entity.length > 0 && entity.offset >= 0 && entity.offset + entity.length <= text.text.length
  ));
  if (!overlayEntities.length) return message;

  const otherEntities = (text.entities || []).filter((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji);
  const existingCustom = (text.entities || []).filter((entity): entity is ApiMessageEntityCustomEmoji => (
    entity.type === ApiMessageEntityTypes.CustomEmoji
    && !overlayEntities.some((overlayEntity) => (
      overlayEntity.offset === entity.offset && overlayEntity.length === entity.length
    ))
  ));
  const nextText = {
    ...text,
    entities: [...otherEntities, ...existingCustom, ...overlayEntities]
      .sort((left, right) => left.offset - right.offset),
  };
  const content = {
    ...message.content,
    text: nextText,
  };
  const emojiOnlyCount = getEmojiOnlyCountForMessage(content, message.groupedId);
  if (emojiOnlyCount) nextText.emojiOnlyCount = emojiOnlyCount;

  return {
    ...message,
    content,
  };
}

export function bindBygramPremiumRealtime() {
  if (didBindRealtime) return;
  didBindRealtime = true;
  hydrateOverlays();
}

function registerOutgoingPremiumOverlay({
  chatId,
  text,
  entities,
}: {
  chatId: string;
  text: string;
  entities: ApiMessageEntityCustomEmoji[];
}) {
  const senderUserId = getGlobal().currentUserId;
  if (!senderUserId || !text || !entities.length) return;

  hydrateOverlays();
  const overlay: BygramChatOverlay = {
    id: `local-${chatId}-${getServerTime()}-${entities.map((entity) => entity.documentId).join('-')}`,
    chatId,
    senderUserId,
    text,
    entities: entities.map((entity) => ({ ...entity })),
    createdAt: getServerTime(),
  };
  const current = overlaysByChat.get(chatId) || [];
  overlaysByChat.set(chatId, [...current, overlay].slice(-OVERLAY_LIMIT));
  persistOverlays();
  notifyOverlays(chatId);
}

function ingestServerOverlay(message: BygramPremiumEmojiMessage) {
  const currentUserId = getGlobal().currentUserId;
  if (!currentUserId) return;

  const chatId = message.senderUserId === currentUserId ? message.recipientUserId : message.senderUserId;
  if (!chatId) return;

  hydrateOverlays();
  const createdAt = Math.max(1, Math.floor(Date.parse(message.createdAt) / 1000) || getServerTime());
  const entity: ApiMessageEntityCustomEmoji = {
    type: ApiMessageEntityTypes.CustomEmoji,
    offset: message.offset ?? 0,
    length: message.length ?? 0,
    documentId: message.documentId,
  };
  const list = overlaysByChat.get(chatId) || [];
  const existing = list.find((item) => (
    item.senderUserId === message.senderUserId
    && (!message.text || !item.text || item.text === message.text)
    && Math.abs(item.createdAt - createdAt) <= 2
  ));

  if (existing) {
    if (message.text && !existing.text) existing.text = message.text;
    if (message.telegramMessageId) existing.messageId = message.telegramMessageId;
    if (!existing.entities.some((item) => (
      item.documentId === entity.documentId && item.offset === entity.offset
    ))) {
      existing.entities.push(entity);
    }
    persistOverlays();
    notifyOverlays(chatId);
    return;
  }

  overlaysByChat.set(chatId, [...list, {
    id: message.id,
    chatId,
    senderUserId: message.senderUserId,
    text: message.text || '',
    entities: [entity],
    createdAt,
    messageId: message.telegramMessageId,
  }].slice(-OVERLAY_LIMIT));
  persistOverlays();
  notifyOverlays(chatId);
}

function findOverlayForMessage(message: ApiMessage, overlays?: BygramChatOverlay[]) {
  if (!overlays?.length) return undefined;
  const senderId = message.senderId || (message.isOutgoing ? getGlobal().currentUserId : message.chatId);
  const text = message.content.text?.text;
  if (!senderId || !text) return undefined;

  return overlays.find((overlay) => {
    if (overlay.senderUserId !== senderId) return false;
    if (
      overlay.messageId === message.id
      || overlay.previousLocalId === message.id
      || overlay.messageId === message.previousLocalId
      || overlay.previousLocalId === message.previousLocalId
    ) {
      return overlayFitsMessage(overlay, text);
    }
    if (overlay.text && overlay.text !== text) return false;
    if (Math.abs(overlay.createdAt - message.date) > OVERLAY_MATCH_SECONDS) return false;
    return overlayFitsMessage(overlay, text);
  });
}

function overlayFitsMessage(overlay: BygramChatOverlay, text: string) {
  if (overlay.text && overlay.text !== text) return false;
  if (overlay.entities.every((entity) => entity.length > 0)) {
    return overlay.entities.every((entity) => entity.offset + entity.length <= text.length);
  }
  return overlay.entities.length === 1;
}

function messageHasOverlayEntities(
  text: { entities?: ApiMessageEntity[] },
  overlay: BygramChatOverlay,
) {
  const existing = text.entities?.filter((entity): entity is ApiMessageEntityCustomEmoji => (
    entity.type === ApiMessageEntityTypes.CustomEmoji
  )) || [];
  return overlay.entities.every((overlayEntity) => existing.some((entity) => (
    entity.documentId === overlayEntity.documentId
    && (overlayEntity.length === 0 || (
      entity.offset === overlayEntity.offset && entity.length === overlayEntity.length
    ))
  )));
}

function collectCustomEmojiEntities(entities?: ApiMessageEntity[]) {
  return (entities || []).filter((entity): entity is ApiMessageEntityCustomEmoji => (
    entity.type === ApiMessageEntityTypes.CustomEmoji
  ));
}

function getPaidCustomEmojiEntities(entities?: ApiMessageEntity[]) {
  const global = getGlobal();
  return collectCustomEmojiEntities(entities).filter((entity) => !selectCustomEmoji(global, entity.documentId)?.isFree);
}

function notifyOverlays(chatId: string) {
  overlayListeners.forEach((listener) => listener(chatId));
}

function hydrateOverlays() {
  if (didHydrateOverlays || typeof localStorage === 'undefined') return;
  didHydrateOverlays = true;
  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, BygramChatOverlay[]>;
    Object.entries(parsed).forEach(([chatId, overlays]) => {
      if (!Array.isArray(overlays)) return;
      overlaysByChat.set(chatId, overlays.filter((overlay) => (
        overlay && typeof overlay.id === 'string' && Array.isArray(overlay.entities)
      )).slice(-OVERLAY_LIMIT));
    });
  } catch {
    // Ignore broken local overlay cache.
  }
}

function persistOverlays() {
  if (typeof localStorage === 'undefined') return;
  try {
    const data: Record<string, BygramChatOverlay[]> = {};
    overlaysByChat.forEach((overlays, chatId) => {
      data[chatId] = overlays.slice(-OVERLAY_LIMIT);
    });
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / private-mode failures.
  }
}
