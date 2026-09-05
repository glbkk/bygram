import type { ApiMessage } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { IS_OPUS_SUPPORTED, IS_SAFARI } from './browser/windowEnvironment';
import { getMessageMediaHash, getMessageVideo, getMessageVoice } from '../global/helpers';
import { fetchBlob } from './files';
import * as mediaLoader from './mediaLoader';
import { oggToPcm, oggToWav } from './oggToWav';

const TARGET_SAMPLE_RATE = 16_000;
const WORKER_TIMEOUT_MS = 180_000;

type ProgressFn = (message: string) => void;

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

async function decodeWithAudioContext(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number } | undefined> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return undefined;

  const context: AudioContext = new AudioCtx();
  try {
    // iOS may keep context suspended until a user gesture; resume just in case.
    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return {
      samples: buffer.getChannelData(0),
      sampleRate: buffer.sampleRate,
    };
  } catch {
    return undefined;
  } finally {
    void context.close?.();
  }
}

/**
 * Prefer the same decode path Telegram Web already uses for playback on Safari:
 * mediaLoader converts OGG→WAV when Opus isn't natively playable.
 */
async function preparePcm(message: ApiMessage, onProgress?: ProgressFn): Promise<Float32Array> {
  const hash = getMessageMediaHash(message, {}, 'download')
    || getMessageMediaHash(message, {}, 'inline');
  if (!hash) {
    throw new Error('Нет медиа у голосового сообщения');
  }

  onProgress?.('Скачивание голоса…');
  const mediaUrl = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('Не удалось скачать голосовое');
  }

  const blob = await fetchBlob(mediaUrl);
  const isOggLike = /ogg|opus/i.test(blob.type)
    || ((!blob.type || blob.type === 'application/octet-stream') && Boolean(getMessageVoice(message)));

  // 1) Direct Opus→PCM (same workers used for Safari playback conversion).
  if (isOggLike || (IS_SAFARI && !IS_OPUS_SUPPORTED)) {
    onProgress?.('Декодирование Opus…');
    try {
      // If mediaLoader already converted to WAV, this may be a wav blob — try AudioContext first.
      if (/wav|wave/i.test(blob.type) || blob.type === 'audio/wav') {
        const decoded = await decodeWithAudioContext(blob);
        if (decoded?.samples.length) {
          return resampleMono(decoded.samples, decoded.sampleRate, TARGET_SAMPLE_RATE);
        }
      }

      const pcm = await oggToPcm(blob);
      return resampleMono(pcm.samples, pcm.sampleRate, TARGET_SAMPLE_RATE);
    } catch {
      onProgress?.('Конвертация в WAV…');
      const wav = await oggToWav(blob);
      const decoded = await decodeWithAudioContext(wav);
      if (decoded?.samples.length) {
        return resampleMono(decoded.samples, decoded.sampleRate, TARGET_SAMPLE_RATE);
      }
    }
  }

  const decoded = await decodeWithAudioContext(blob);
  if (!decoded?.samples.length) {
    throw new Error('Не удалось декодировать аудио на устройстве');
  }

  return resampleMono(decoded.samples, decoded.sampleRate, TARGET_SAMPLE_RATE);
}

let requestId = 0;

function runInWorker(pcm: Float32Array, onProgress?: ProgressFn): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const worker = new Worker(
      new URL('./bygramVoiceTranscribe.worker.ts', import.meta.url),
      { type: 'module', name: 'bygram-voice-transcribe' },
    );

    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('Таймаут расшифровки (PWA). Попробуйте ещё раз на более коротком голосовом.'));
    }, WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        id: number;
        ok?: boolean;
        text?: string;
        error?: string;
        progress?: string;
      };
      if (data.id !== id) return;

      if (data.progress) {
        onProgress?.(data.progress);
        return;
      }

      window.clearTimeout(timer);
      worker.terminate();

      if (data.ok && data.text) {
        resolve(data.text);
        return;
      }

      reject(new Error(data.error || 'Ошибка локальной расшифровки'));
    };

    worker.onerror = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message || 'Worker расшифровки упал'));
    };

    // Transfer the underlying buffer to avoid a second copy in the worker.
    const copy = pcm.slice();
    worker.postMessage({ id, pcm: copy, sampleRate: TARGET_SAMPLE_RATE }, [copy.buffer]);
  });
}

export async function transcribeVoiceLocally(
  message: ApiMessage,
  onProgress?: ProgressFn,
): Promise<string> {
  if (!canTranscribeMessage(message)) {
    throw new Error('Сообщение не является голосовым');
  }

  const pcm = await preparePcm(message, onProgress);
  if (!pcm.length) {
    throw new Error('Пустое аудио после декодирования');
  }

  onProgress?.('Запуск распознавания…');
  return runInWorker(pcm, onProgress);
}

export function createLocalTranscriptionId(chatId: string, messageId: number) {
  return `bygram-local-${chatId}-${messageId}-${Date.now()}`;
}
