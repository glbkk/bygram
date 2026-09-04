import type { ApiMessage } from '../api/types';
import type { SendMessageParams } from '../types';
import { ApiMediaFormat } from '../api/types';

import {
  getMediaFilename,
  getMessageAudio,
  getMessageDocument,
  getMessageMediaHash,
  getMessagePhoto,
  getMessageSticker,
  getMessageVideo,
  getMessageVoice,
  hasMessageTtl,
  isActionMessage,
  isMessageLocal,
} from '../global/helpers';
import buildAttachment, { buildGifAttachment } from '../components/middle/composer/helpers/buildAttachment';
import { fetchBlob } from './files';
import { generateWaveform } from './generateWaveform';
import * as mediaLoader from './mediaLoader';

const UNSUPPORTED_COPY_KEYS = [
  'storyData',
  'invoice',
  'pollId',
  'todo',
  'game',
  'contact',
  'dice',
  'paidMedia',
  'giveaway',
  'giveawayResults',
  'location',
  'action',
] as const;

export function canCopyRestrictedMessage(message: ApiMessage) {
  if (isMessageLocal(message) || isActionMessage(message) || hasMessageTtl(message)) {
    return false;
  }

  const { content } = message;
  if (UNSUPPORTED_COPY_KEYS.some((key) => Boolean(content[key]))) {
    return false;
  }

  if (getMessageSticker(message)) return true;
  if (getMessagePhoto(message)) return true;
  if (getMessageVideo(message)) return true;
  if (getMessageDocument(message)) return true;
  if (getMessageAudio(message)) return true;
  if (getMessageVoice(message)) return true;
  if (content.text?.text) return true;

  return false;
}

async function fetchMessageMediaBlob(message: ApiMessage) {
  const hash = getMessageMediaHash(message, {}, 'download')
    || getMessageMediaHash(message, {}, 'full')
    || getMessageMediaHash(message, {}, 'inline');
  if (!hash) return undefined;

  const mediaUrl = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
  if (!mediaUrl || typeof mediaUrl !== 'string') return undefined;

  return fetchBlob(mediaUrl);
}

async function buildMediaAttachment(message: ApiMessage) {
  const sticker = getMessageSticker(message);
  if (sticker) {
    return { sticker } satisfies Partial<SendMessageParams>;
  }

  const video = getMessageVideo(message);
  if (video?.isGif) {
    return {
      attachment: buildGifAttachment(video),
    } satisfies Partial<SendMessageParams>;
  }

  const blob = await fetchMessageMediaBlob(message);
  if (!blob) return undefined;

  const photo = getMessagePhoto(message);
  const voice = getMessageVoice(message);
  const audio = getMessageAudio(message);
  const document = getMessageDocument(message);
  const media = photo || video || voice || audio || document;
  if (!media) return undefined;

  const filename = getMediaFilename(media);
  if (voice) {
    return {
      attachment: await buildAttachment(filename, blob, {
        voice: {
          duration: voice.duration,
          waveform: voice.waveform?.length
            ? voice.waveform
            : generateWaveform(voice.duration),
        },
      }),
    } satisfies Partial<SendMessageParams>;
  }

  if (video?.isRound) {
    return {
      attachment: await buildAttachment(filename, blob, {
        isRoundVideo: true,
        quick: {
          width: video.width || 0,
          height: video.height || 0,
          duration: video.duration,
        },
      }),
    } satisfies Partial<SendMessageParams>;
  }

  if (audio) {
    return {
      attachment: await buildAttachment(filename, blob, {
        audio: {
          duration: audio.duration,
          title: audio.title,
          performer: audio.performer,
        },
      }),
    } satisfies Partial<SendMessageParams>;
  }

  return {
    attachment: await buildAttachment(filename, blob),
  } satisfies Partial<SendMessageParams>;
}

export async function buildUnrestrictedForwardSendParams(
  message: ApiMessage,
  options: {
    noCaptions?: boolean;
    groupedId?: string;
  } = {},
): Promise<Partial<SendMessageParams> | undefined> {
  if (!canCopyRestrictedMessage(message)) return undefined;

  const { noCaptions, groupedId } = options;
  const textPayload = !noCaptions && message.content.text
    ? {
      text: message.content.text.text,
      entities: message.content.text.entities,
    }
    : undefined;

  const mediaParams = await buildMediaAttachment(message);
  if (!mediaParams && !textPayload?.text) {
    return undefined;
  }

  // Stickers are sent without captions in Telegram.
  if (mediaParams?.sticker) {
    return {
      sticker: mediaParams.sticker,
      groupedId,
    };
  }

  return {
    ...textPayload,
    ...mediaParams,
    groupedId,
  };
}

export function groupMessagesForUnrestrictedForward(messages: ApiMessage[]) {
  const groups: ApiMessage[][] = [];
  const groupedBuckets = new Map<string, ApiMessage[]>();

  for (const message of messages) {
    if (!message.groupedId) {
      groups.push([message]);
      continue;
    }

    const existing = groupedBuckets.get(message.groupedId);
    if (existing) {
      existing.push(message);
      continue;
    }

    const bucket = [message];
    groupedBuckets.set(message.groupedId, bucket);
    groups.push(bucket);
  }

  return groups;
}

export function createClientGroupedId() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}
