import type { ApiMessage } from '../api/types';
import type {
  ByProtoPeerBanner,
  ByProtoPeerSnapshot,
  ValidByProtoEnvelope,
} from './types';
import { ApiMediaFormat, ApiMessageEntityTypes } from '../api/types';

import {
  getDocumentMediaHash,
  getMessageContent,
  getPhotoMediaHash,
  getVideoMediaHash,
} from '../global/helpers';
import { getBygramSettings } from '../util/bygramArchive';
import {
  getBygramProfileBannerKey,
  removeBygramCustomizationMedia,
  saveBygramCustomizationMedia,
} from '../util/bygramCustomization';
import { registerByProtoPremiumOverlay, rememberBygramProfile } from '../util/bygramPremium';
import * as mediaLoader from '../util/mediaLoader';
import { ByProtoStore } from './store';

type Listener = (snapshot: ByProtoPeerSnapshot) => void;

const snapshots = new Map<string, ByProtoPeerSnapshot>();
const listeners = new Map<string, Set<Listener>>();
const loadingPeers = new Map<string, Promise<ByProtoPeerSnapshot>>();
const processingPackets = new Set<string>();
const MAX_BANNER_BYTES = 50 * 1024 * 1024;

export function ingestByProtoEnvelope(message: ApiMessage, senderId: string, envelope: ValidByProtoEnvelope) {
  if (!getBygramSettings().isByProtoEnabled || processingPackets.has(envelope.id)) return;
  processingPackets.add(envelope.id);
  void processEnvelope(message, senderId, envelope)
    .catch(() => undefined)
    .finally(() => processingPackets.delete(envelope.id));
}

export async function applyByProtoEnvelope(
  message: ApiMessage, senderId: string, envelope: ValidByProtoEnvelope,
) {
  if (!getBygramSettings().isByProtoEnabled) return false;
  return processEnvelope(message, senderId, envelope, true);
}

export function getByProtoPeerSnapshot(peerId: string) {
  return snapshots.get(peerId);
}

export function ensureByProtoPeerLoaded(peerId: string) {
  const current = snapshots.get(peerId);
  if (current) return Promise.resolve(current);
  const inflight = loadingPeers.get(peerId);
  if (inflight) return inflight;

  const request = Promise.all([
    ByProtoStore.getPeerProfile(peerId),
    ByProtoStore.getPeerBubble(peerId),
    ByProtoStore.getPeerBanner(peerId),
    ByProtoStore.getPeerCapabilities(peerId),
  ]).then(([profile, bubble, banner, capabilities]) => {
    const snapshot = { profile, bubble, banner, capabilities };
    snapshots.set(peerId, snapshot);
    return snapshot;
  }).finally(() => loadingPeers.delete(peerId));
  loadingPeers.set(peerId, request);
  return request;
}

export function subscribeByProtoPeer(peerId: string, listener: Listener) {
  let peerListeners = listeners.get(peerId);
  if (!peerListeners) {
    peerListeners = new Set();
    listeners.set(peerId, peerListeners);
  }
  peerListeners.add(listener);
  return () => {
    peerListeners.delete(listener);
    if (!peerListeners.size) listeners.delete(peerId);
  };
}

export async function resetByProtoPeerBanner(peerId: string) {
  await Promise.all([
    ByProtoStore.deletePeerBanner(peerId),
    removeBygramCustomizationMedia(getBygramProfileBannerKey(peerId)),
  ]);
  updateSnapshot(peerId, { banner: undefined });
}

async function processEnvelope(
  message: ApiMessage, senderId: string, envelope: ValidByProtoEnvelope, shouldForceAccept = false,
) {
  if (await ByProtoStore.hasProcessedPacket(envelope.id)) return true;
  let wasProcessed = true;

  switch (envelope.type) {
    case 'client.capabilities': {
      const capabilities = {
        peerId: senderId,
        protocol: envelope.payload.protocol,
        features: [...envelope.payload.features],
        updatedAt: Date.now(),
      };
      await ByProtoStore.setPeerCapabilities(capabilities);
      updateSnapshot(senderId, { capabilities });
      break;
    }
    case 'profile.update': {
      if (!shouldForceAccept && !getBygramSettings().isByProtoAutoAcceptProfiles) {
        wasProcessed = false;
        break;
      }
      const current = await ByProtoStore.getPeerProfile(senderId);
      if (current && current.revision >= envelope.payload.revision) break;
      const profile = {
        peerId: senderId,
        revision: envelope.payload.revision,
        bubblePreset: envelope.payload.bubblePreset,
        bubbleParams: envelope.payload.bubbleParams,
        bannerRevision: envelope.payload.bannerRevision,
        statusEmoji: envelope.payload.statusEmoji,
        updatedAt: Date.now(),
      };
      await ByProtoStore.setPeerProfile(profile);
      rememberBygramProfile({
        telegramUserId: senderId,
        bubbleStyle: profile.bubblePreset,
        premiumEmojiStatusId: profile.statusEmoji,
        createdAt: new Date(profile.updatedAt).toISOString(),
        updatedAt: new Date(profile.updatedAt).toISOString(),
      });
      if (envelope.payload.bubblePreset) {
        const bubble = {
          peerId: senderId,
          presetId: envelope.payload.bubblePreset,
          revision: envelope.payload.revision,
          params: envelope.payload.bubbleParams,
          updatedAt: Date.now(),
        };
        await ByProtoStore.setPeerBubble(bubble);
        updateSnapshot(senderId, { profile, bubble });
      } else {
        updateSnapshot(senderId, { profile });
      }
      break;
    }
    case 'emoji.message':
      registerByProtoPremiumOverlay({
        packetId: envelope.id,
        chatId: message.chatId,
        senderUserId: senderId,
        messageId: message.id,
        text: message.content.text?.text || '',
        createdAt: message.date,
        entities: envelope.payload.ranges.map((range) => ({
          type: ApiMessageEntityTypes.CustomEmoji,
          offset: range.start,
          length: range.length,
          documentId: range.emojiAssetId,
        })),
      });
      break;
    case 'profile.banner':
      wasProcessed = await acceptPeerBanner(
        message, senderId, envelope.payload.revision, shouldForceAccept,
      );
      break;
  }

  if (wasProcessed) await ByProtoStore.markPacketProcessed(envelope.id);
  return wasProcessed;
}

async function acceptPeerBanner(
  message: ApiMessage, senderId: string, revision: number, shouldForceAccept: boolean,
) {
  if (!shouldForceAccept && !getBygramSettings().isByProtoAutoAcceptProfiles) return false;
  const current = await ByProtoStore.getPeerBanner(senderId);
  if (current && current.revision >= revision) return true;

  const { photo, video, document } = getMessageContent(message);
  const mediaHash = video
    ? getVideoMediaHash(video, 'full')
    : photo ? getPhotoMediaHash(photo, 'full') : document ? getDocumentMediaHash(document, 'full') : undefined;
  if (!mediaHash) return false;

  const mediaUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
  const blob = await fetch(mediaUrl).then((response) => response.blob());
  if (!blob.size || blob.size > MAX_BANNER_BYTES || !isAllowedBannerMime(blob.type)) return true;

  await saveBygramCustomizationMedia(getBygramProfileBannerKey(senderId), blob, 'byproto');
  const banner: ByProtoPeerBanner = {
    peerId: senderId,
    revision,
    messageId: message.id,
    mimeType: blob.type,
    updatedAt: Date.now(),
  };
  await ByProtoStore.setPeerBanner(banner);
  updateSnapshot(senderId, { banner });
  return true;
}

function updateSnapshot(peerId: string, patch: Partial<ByProtoPeerSnapshot>) {
  const snapshot = { ...snapshots.get(peerId), ...patch };
  snapshots.set(peerId, snapshot);
  listeners.get(peerId)?.forEach((listener) => listener(snapshot));
}

function isAllowedBannerMime(mimeType: string) {
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
  ].includes(mimeType);
}
