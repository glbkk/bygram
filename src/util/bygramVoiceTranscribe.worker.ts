/// <reference lib="webworker" />

/**
 * Runs Whisper entirely off the UI thread so iOS PWA does not reload the page
 * when ONNX briefly spikes memory.
 */

type WorkerRequest = {
  id: number;
  pcm: Float32Array;
  sampleRate: number;
};

type WorkerResponse =
  | { id: number; ok: true; text: string }
  | { id: number; ok: false; error: string }
  | { id: number; progress: string };

const TARGET_SAMPLE_RATE = 16_000;
const WHISPER_MODEL = 'Xenova/whisper-tiny';

type AsrPipeline = (audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>;

let pipelinePromise: Promise<AsrPipeline> | undefined;

function ortWasmBaseUrl() {
  // Worker may be emitted at `/bygramVoice….js` or `/assets/….js` depending on Vite.
  const url = new URL(self.location.href);
  url.pathname = url.pathname.replace(/\/[^/]+$/, '/');
  if (url.pathname.endsWith('/assets/')) {
    url.pathname = url.pathname.replace(/\/assets\/$/, '/');
  }
  return new URL('ort/', url).href;
}

async function getPipeline(onProgress: (message: string) => void): Promise<AsrPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      onProgress('Загрузка движка…');
      const transformers = await import('@huggingface/transformers') as {
        env: {
          allowLocalModels: boolean;
          useBrowserCache: boolean;
          backends?: {
            onnx?: {
              wasm?: {
                numThreads?: number;
                proxy?: boolean;
                simd?: boolean;
                wasmPaths?: string;
              };
            };
          };
        };
        pipeline: (...args: unknown[]) => Promise<AsrPipeline>;
      };

      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;

      if (transformers.env.backends?.onnx?.wasm) {
        transformers.env.backends.onnx.wasm.numThreads = 1;
        transformers.env.backends.onnx.wasm.proxy = false;
        // iOS WebKit: SIMD WASM paths historically crash / reload the tab.
        transformers.env.backends.onnx.wasm.simd = false;
        transformers.env.backends.onnx.wasm.wasmPaths = ortWasmBaseUrl();
      }

      const hasWebGpu = typeof navigator !== 'undefined' && Boolean((navigator as any).gpu);
      const device = hasWebGpu ? 'webgpu' : 'wasm';
      const dtype = hasWebGpu ? 'fp16' : 'fp32';

      onProgress(hasWebGpu ? 'Загрузка модели (WebGPU)…' : 'Загрузка модели (WASM)…');

      try {
        return await transformers.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
          device,
          dtype,
          progress_callback: (event: { status?: string; progress?: number }) => {
            if (event?.status === 'progress' && typeof event.progress === 'number') {
              onProgress(`Модель ${Math.round(event.progress)}%…`);
            }
          },
        });
      } catch (webGpuError) {
        if (!hasWebGpu) throw webGpuError;
        onProgress('WebGPU недоступен, переключаюсь на WASM…');
        return transformers.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
          device: 'wasm',
          dtype: 'fp32',
        });
      }
    })().catch((error) => {
      pipelinePromise = undefined;
      throw error;
    });
  }

  return pipelinePromise;
}

function extractText(result: unknown): string | undefined {
  if (!result) return undefined;
  if (typeof result === 'string') return result.trim() || undefined;
  if (Array.isArray(result)) {
    const joined = result.map((part) => (part && typeof part === 'object' && 'text' in part
      ? String((part as { text?: string }).text || '')
      : '')).join(' ').trim();
    return joined || undefined;
  }
  if (typeof result === 'object' && result && 'text' in result) {
    const text = String((result as { text?: string }).text || '').trim();
    return text || undefined;
  }
  return undefined;
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

async function transcribe(pcm: Float32Array, sampleRate: number, onProgress: (message: string) => void) {
  const audio = resampleMono(pcm, sampleRate, TARGET_SAMPLE_RATE);
  const asr = await getPipeline(onProgress);
  onProgress('Распознавание…');

  // Try Russian first (bygram audience), then auto-detect.
  let result = await asr(audio, {
    sampling_rate: TARGET_SAMPLE_RATE,
    task: 'transcribe',
    language: 'russian',
    return_timestamps: false,
    chunk_length_s: 20,
    stride_length_s: 3,
  });

  let text = extractText(result);
  if (!text) {
    result = await asr(audio, {
      sampling_rate: TARGET_SAMPLE_RATE,
      task: 'transcribe',
      return_timestamps: false,
      chunk_length_s: 20,
      stride_length_s: 3,
    });
    text = extractText(result);
  }

  if (!text) {
    throw new Error('Пустой результат распознавания');
  }

  return text;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, pcm, sampleRate } = event.data;
  const post = (payload: WorkerResponse) => {
    (self as DedicatedWorkerGlobalScope).postMessage(payload);
  };

  void (async () => {
    try {
      const text = await transcribe(pcm, sampleRate, (progress) => {
        post({ id, progress });
      });
      post({ id, ok: true, text });
    } catch (error) {
      post({
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};

export {};
