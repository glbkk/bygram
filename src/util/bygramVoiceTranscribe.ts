import type { ApiMessage } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getMessageMediaHash, getMessageVideo, getMessageVoice } from '../global/helpers';
import { fetchBlob } from './files';
import * as mediaLoader from './mediaLoader';
import { oggToWav } from './oggToWav';

// Multilingual tiny — first click downloads ~40MB once, then cached by the browser.
const WHISPER_MODEL = 'Xenova/whisper-tiny';

type AsrPipeline = (audio: string | Float32Array, options?: Record<string, unknown>) => Promise<{
  text?: string;
} | string>;

let pipelinePromise: Promise<AsrPipeline> | undefined;

function canTranscribeMessage(message: ApiMessage) {
  const voice = getMessageVoice(message);
  if (voice) return true;
  const video = getMessageVideo(message);
  return Boolean(video?.isRound);
}

async function getAsrPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const transformers = await import('@huggingface/transformers') as {
        env: { allowLocalModels: boolean; useBrowserCache: boolean };
        pipeline: (...args: unknown[]) => Promise<AsrPipeline>;
      };
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;

      return transformers.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        dtype: 'q8',
      });
    })().catch((error) => {
      pipelinePromise = undefined;
      throw error;
    });
  }

  return pipelinePromise;
}

async function prepareAudioUrl(message: ApiMessage) {
  const hash = getMessageMediaHash(message, {}, 'download')
    || getMessageMediaHash(message, {}, 'inline');
  if (!hash) return undefined;

  const mediaUrl = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
  if (!mediaUrl || typeof mediaUrl !== 'string') return undefined;

  const blob = await fetchBlob(mediaUrl);
  const isOggLike = /ogg|opus/i.test(blob.type)
    || ((!blob.type || blob.type === 'application/octet-stream') && Boolean(getMessageVoice(message)));

  // Safari and Whisper both prefer WAV; Telegram voice is usually OGG/Opus.
  if (isOggLike) {
    try {
      const wav = await oggToWav(blob);
      return { url: URL.createObjectURL(wav), shouldRevoke: true };
    } catch {
      // Fall through to the original blob URL if Opus decode fails.
    }
  }

  return { url: mediaUrl, shouldRevoke: false };
}

function extractText(result: { text?: string } | string | undefined) {
  if (!result) return undefined;
  const text = typeof result === 'string' ? result : result.text;
  const trimmed = text?.trim();
  return trimmed || undefined;
}

export async function transcribeVoiceLocally(message: ApiMessage): Promise<string | undefined> {
  if (!canTranscribeMessage(message)) return undefined;

  const prepared = await prepareAudioUrl(message);
  if (!prepared) return undefined;

  try {
    const transcriber = await getAsrPipeline();
    const result = await transcriber(prepared.url, {
      task: 'transcribe',
      // Let Whisper pick the language — works for RU/EN/etc. without an extra setting.
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    return extractText(result);
  } finally {
    if (prepared.shouldRevoke) {
      URL.revokeObjectURL(prepared.url);
    }
  }
}

export function createLocalTranscriptionId(chatId: string, messageId: number) {
  return `bygram-local-${chatId}-${messageId}-${Date.now()}`;
}
