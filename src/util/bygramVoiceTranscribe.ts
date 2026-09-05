import type { ApiMessage } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { IS_IOS, IS_SAFARI } from './browser/windowEnvironment';
import { getMessageMediaHash, getMessageVideo, getMessageVoice } from '../global/helpers';
import { fetchBlob } from './files';
import * as mediaLoader from './mediaLoader';
import { oggToPcm, oggToWav } from './oggToWav';

// Tiny multilingual model — first run downloads once, then browser-cached.
const WHISPER_MODEL = 'Xenova/whisper-tiny';
const TRANSCRIBE_TIMEOUT_MS = 120_000;
const TARGET_SAMPLE_RATE = 16_000;

type AsrPipeline = (audio: Float32Array | string, options?: Record<string, unknown>) => Promise<{
  text?: string;
} | Array<{ text?: string }> | string>;

let pipelinePromise: Promise<AsrPipeline> | undefined;

function canTranscribeMessage(message: ApiMessage) {
  const voice = getMessageVoice(message);
  if (voice) return true;
  const video = getMessageVideo(message);
  return Boolean(video?.isRound);
}

function resampleMono(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const src = i * ratio;
    const left = Math.floor(src);
    const right = Math.min(input.length - 1, left + 1);
    const frac = src - left;
    output[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return output;
}

async function getAsrPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const transformers = await import('@huggingface/transformers') as {
        env: {
          allowLocalModels: boolean;
          useBrowserCache: boolean;
          backends?: {
            onnx?: {
              wasm?: {
                numThreads?: number;
                proxy?: boolean;
              };
            };
          };
        };
        pipeline: (...args: unknown[]) => Promise<AsrPipeline>;
      };

      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
      if (transformers.env.backends?.onnx?.wasm) {
        // Safari / iOS: SharedArrayBuffer multi-thread path is unstable.
        transformers.env.backends.onnx.wasm.numThreads = 1;
        transformers.env.backends.onnx.wasm.proxy = false;
      }

      // q8 breaks on many iOS/Safari builds; fp32 is slower but reliable.
      const dtype = (IS_IOS || IS_SAFARI) ? 'fp32' : 'q8';

      return transformers.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        dtype,
      });
    })().catch((error) => {
      pipelinePromise = undefined;
      throw error;
    });
  }

  return pipelinePromise;
}

async function decodeWavOrNative(blob: Blob): Promise<Float32Array | undefined> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return undefined;

  const context: AudioContext = new AudioCtx();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return resampleMono(buffer.getChannelData(0), buffer.sampleRate, TARGET_SAMPLE_RATE);
  } catch {
    return undefined;
  } finally {
    void context.close?.();
  }
}

async function preparePcm(message: ApiMessage): Promise<Float32Array | undefined> {
  const hash = getMessageMediaHash(message, {}, 'download')
    || getMessageMediaHash(message, {}, 'inline');
  if (!hash) return undefined;

  const mediaUrl = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
  if (!mediaUrl || typeof mediaUrl !== 'string') return undefined;

  const blob = await fetchBlob(mediaUrl);
  const isOggLike = /ogg|opus/i.test(blob.type)
    || ((!blob.type || blob.type === 'application/octet-stream') && Boolean(getMessageVoice(message)));

  if (isOggLike) {
    try {
      const pcm = await oggToPcm(blob);
      return resampleMono(pcm.samples, pcm.sampleRate, TARGET_SAMPLE_RATE);
    } catch {
      try {
        const wav = await oggToWav(blob);
        return decodeWavOrNative(wav);
      } catch {
        // fall through
      }
    }
  }

  return decodeWavOrNative(blob);
}

function extractText(result: { text?: string } | Array<{ text?: string }> | string | undefined) {
  if (!result) return undefined;
  if (typeof result === 'string') return result.trim() || undefined;
  if (Array.isArray(result)) {
    const joined = result.map((part) => part.text || '').join(' ').trim();
    return joined || undefined;
  }
  return result.text?.trim() || undefined;
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

  const pcm = await preparePcm(message);
  if (!pcm?.length) {
    throw new Error('Could not decode voice audio to PCM');
  }

  const transcriber = await withTimeout(getAsrPipeline(), TRANSCRIBE_TIMEOUT_MS, 'whisper-load');
  const result = await withTimeout(
    transcriber(pcm, {
      // Explicit sampling rate — required when passing raw Float32Array.
      sampling_rate: TARGET_SAMPLE_RATE,
      task: 'transcribe',
      language: undefined,
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    }),
    TRANSCRIBE_TIMEOUT_MS,
    'whisper-infer',
  );

  return extractText(result);
}

export function createLocalTranscriptionId(chatId: string, messageId: number) {
  return `bygram-local-${chatId}-${messageId}-${Date.now()}`;
}
