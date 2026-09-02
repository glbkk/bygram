export const BYPROTO_VERSION = 1 as const;
export const BYPROTO_MAX_PACKET_BYTES = 900;
export const BYPROTO_MAX_EMOJI_RANGES = 12;

export const BYPROTO_FEATURES = [
  'bubble-profile',
  'profile-banner',
  'custom-emoji',
  'music-share',
] as const;

export type ByProtoFeature = typeof BYPROTO_FEATURES[number];

export const BYPROTO_BUBBLE_PRESETS = [
  'default',
  'ocean',
  'violet',
  'sunset',
  'mint',
  'homemade-cake',
  'jelly-bunny',
  'spiced-wine',
  'santa-hat',
  'plush-pepe',
  'bow-tie',
  'hanging-star',
  'trapped-heart',
  'rare-bird',
  'sharp-tongue',
  'nail-bracelet',
  'ginger-cookie',
  'fresh-socks',
  'liberty-figure',
  'custom',
] as const;

export type ByProtoBubblePreset = typeof BYPROTO_BUBBLE_PRESETS[number];

export type ByProtoEnvelope = {
  v: 1;
  type: string;
  id: string;
  ts: number;
  payload: unknown;
};

export type ByProtoEmojiRange = {
  start: number;
  length: number;
  emojiAssetId: string;
};

export type ByProtoEmojiMessageEnvelope = ByProtoEnvelope & {
  type: 'emoji.message';
  payload: { ranges: ByProtoEmojiRange[] };
};

export type ByProtoBubbleProfile = {
  presetId: ByProtoBubblePreset;
  revision: number;
  params?: ByProtoBubbleParams;
};

export type ByProtoBubbleParams = {
  colorStart: string;
  colorEnd: string;
  gradient: boolean;
  decorationEmojiId?: string;
};

export type ByProtoProfileUpdateEnvelope = ByProtoEnvelope & {
  type: 'profile.update';
  payload: {
    revision: number;
    bubblePreset?: ByProtoBubblePreset;
    bubbleParams?: ByProtoBubbleParams;
    bannerRevision?: number;
    statusEmoji?: string;
  };
};

export type ByProtoProfileBannerEnvelope = ByProtoEnvelope & {
  type: 'profile.banner';
  payload: {
    revision: number;
    mediaMessageId?: number;
  };
};

export type ByProtoCapabilitiesEnvelope = ByProtoEnvelope & {
  type: 'client.capabilities';
  payload: {
    protocol: 1;
    features: ByProtoFeature[];
  };
};

export type ByProtoMusicTrackPayload = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  durationSeconds: number;
  artworkUrl?: string;
  audioUrl: string;
  mimeType?: string;
};

export type ByProtoMusicTrackEnvelope = ByProtoEnvelope & {
  type: 'music.track';
  payload: ByProtoMusicTrackPayload;
};

export type ByProtoMusicPlaylistPayload = {
  name: string;
  trackIds: string[];
};

export type ByProtoMusicPlaylistEnvelope = ByProtoEnvelope & {
  type: 'music.playlist';
  payload: ByProtoMusicPlaylistPayload;
};

export type ValidByProtoEnvelope =
  | ByProtoEmojiMessageEnvelope
  | ByProtoProfileUpdateEnvelope
  | ByProtoProfileBannerEnvelope
  | ByProtoCapabilitiesEnvelope
  | ByProtoMusicTrackEnvelope
  | ByProtoMusicPlaylistEnvelope;

export type ByProtoPeerProfile = {
  peerId: string;
  revision: number;
  bubblePreset?: ByProtoBubblePreset;
  bubbleParams?: ByProtoBubbleParams;
  bannerRevision?: number;
  statusEmoji?: string;
  updatedAt: number;
};

export type ByProtoPeerCapabilities = {
  peerId: string;
  protocol: 1;
  features: ByProtoFeature[];
  updatedAt: number;
};

export type ByProtoPeerBanner = {
  peerId: string;
  revision: number;
  messageId: number;
  mimeType: string;
  updatedAt: number;
};

export type ByProtoPeerSnapshot = {
  profile?: ByProtoPeerProfile;
  bubble?: ByProtoBubbleProfile;
  banner?: ByProtoPeerBanner;
  capabilities?: ByProtoPeerCapabilities;
};
