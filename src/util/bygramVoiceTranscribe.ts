import type { ApiMessage } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getMessageMediaHash, getMessageVideo, getMessageVoice } from '../global/helpers';
import { fetchBlob } from './files';
import * as mediaLoader from './mediaLoader';
import { oggToWav } from './oggToWav';

// Multilingual tiny — first click downloads ~40MB once, then cached by the browser.
const WHISPER_MODEL = 'Xenova/whisper-tiny';
const TRANSCRIBE_TIMEOUT_MS = 90_000;
const TARGET_SAMPLE_RATE = 16_000;

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
        env: {
          allowLocalModels: boolean;
          useBrowserCache: boolean;
          backends?: { onnx?: { wasm?: { numThreads?: number } } };
        };
        pipeline: (...args: unknown[]) => Promise<AsrPipeline>;
      };
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
      // Safari / iOS PWAs are more stable with a single WASM thread.
      if (transformers.env.backends?.onnx?.wasm) {
        transformers.env.backends.onnx.wasm.numThreads = 1;
      }

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

async function decodeToMonoFloat32(blob: Blob): Promise<Float32Array | undefined> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return undefined;

  const context: AudioContext = new AudioCtx();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    if (buffer.sampleRate === TARGET_SAMPLE_RATE) {
      return new Float32Array(channel);
    }

    const ratio = buffer.sampleRate / TARGET_SAMPLE_RATE;
    const length = Math.max(1, Math.floor(channel.length / ratio));
    const resampled = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      resampled[i] = channel[Math.min(channel.length - 1, Math.floor(i * ratio))];
    }
    return resampled;
  } catch {
    return undefined;
  } finally {
    void context.close?.();
  }
}

async function prepareAudioInput(message: ApiMessage): Promise<
  | { kind: 'url'; url: string; shouldRevoke: boolean }
  | { kind: 'pcm'; data: Float32Array }
  | undefined
> {
  const hash = getMessageMediaHash(message, {}, 'download')
    || getMessageMediaHash(message, {}, 'inline');
  if (!hash) return undefined;

  const mediaUrl = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
  if (!mediaUrl || typeof mediaUrl !== 'string') return undefined;

  const blob = await fetchBlob(mediaUrl);
  const isOggLike = /ogg|opus/i.test(blob.type)
    || ((!blob.type || blob.type === 'application/octet-stream') && Boolean(getMessageVoice(message)));

  let workingBlob = blob;
  if (isOggLike) {
    try {
      workingBlob = await Promise.race([
        oggToWav(blob),
        new Promise<Blob>((_, reject) => {
          window.setTimeout(() => reject(new Error('oggToWav timeout')), 20_000);
        }),
      ]);
    } catch {
      workingBlob = blob;
    }
  }

  const pcm = await decodeToMonoFloat32(workingBlob);
  if (pcm?.length) {
    return { kind: 'pcm', data: pcm };
  }

  if (workingBlob !== blob) {
    return { url: URL.createObjectURL(workingBlob), shouldRevoke: true, kind: 'url' };
  }

  return { kind: 'url', url: mediaUrl, shouldRevoke: false };
}

function extractText(result: { text?: string } | string | undefined) {
  if (!result) return undefined;
  const text = typeof result === 'string' ? result : result.text;
  const trimmed = text?.trim();
  return trimmed || undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function transcribeVoiceLocally(message: ApiMessage): Promise<string | undefined> {
  if (!canTranscribeMessage(message)) return undefined;

  const prepared = await prepareAudioInput(message);
  if (!prepared) return undefined;

  try {
    const transcriber = await withTimeout(getAsrPipeline(), TRANSCRIBE_TIMEOUT_MS, 'whisper-load');
    const input = prepared.kind === 'pcm' ? prepared.data : prepared.url;
    const result = await withTimeout(
      transcriber(input, {
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      }),
      TRANSCRIBE_TIMEOUT_MS,
      'whisper-infer',
    );
    return extractText(result);
  } finally {
    if (prepared.kind === 'url' && prepared.shouldRevoke) {
      URL.revokeObjectURL(prepared.url);
    }
  }
}

export function createLocalTranscriptionId(chatId: string, messageId: number) {
  return `bygram-local-${chatId}-${messageId}-${Date.now()}`;
}
