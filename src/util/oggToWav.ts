import decoderWorkerUrl from 'opus-recorder/dist/decoderWorker.min.js?url';
import waveWorkerUrl from 'opus-recorder/dist/waveWorker.min.js?url';

const SAMPLE_RATE = 48000;
const BIT_DEPTH = 16;
const DECODE_TIMEOUT_MS = 25_000;

export async function oggToWav(opusData: Blob): Promise<Blob> {
  const arrayBuffer = await new Response(opusData).arrayBuffer();

  return new Promise((resolve, reject) => {
    const typedArray = new Uint8Array(arrayBuffer);

    let decoderWorker: Worker | undefined = new Worker(decoderWorkerUrl);
    let wavWorker: Worker | undefined = new Worker(waveWorkerUrl);
    let settled = false;

    const cleanup = () => {
      decoderWorker?.terminate();
      decoderWorker = undefined;
      wavWorker?.terminate();
      wavWorker = undefined;
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timer = window.setTimeout(() => fail(new Error('oggToWav timeout')), DECODE_TIMEOUT_MS);

    decoderWorker.onerror = () => fail(new Error('ogg decoder worker failed'));
    wavWorker.onerror = () => fail(new Error('wav worker failed'));

    decoderWorker.onmessage = (e) => {
      // eslint-disable-next-line no-null/no-null
      if (e.data === null) {
        wavWorker!.postMessage({ command: 'done' });
      } else {
        wavWorker!.postMessage(
          {
            command: 'encode',
            buffers: e.data,
          },
          e.data.map(({ buffer }: Float32Array) => buffer),
        );
      }
    };

    wavWorker.onmessage = (e) => {
      if (e.data.message === 'page') {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        const blob = new Blob([e.data.page], { type: 'audio/wav' });
        cleanup();
        resolve(blob);
      }
    };

    wavWorker.postMessage({
      command: 'init',
      wavBitDepth: BIT_DEPTH,
      wavSampleRate: SAMPLE_RATE,
    });

    decoderWorker.postMessage({
      command: 'init',
      decoderSampleRate: SAMPLE_RATE,
      outputBufferSampleRate: SAMPLE_RATE,
    });

    decoderWorker.postMessage({
      command: 'decode',
      pages: typedArray,
    }, [typedArray.buffer]);
  });
}

/** Decode Telegram OGG/Opus voice notes straight to mono PCM (48 kHz). */
export async function oggToPcm(opusData: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await new Response(opusData).arrayBuffer();

  return new Promise((resolve, reject) => {
    const typedArray = new Uint8Array(arrayBuffer);
    let decoderWorker: Worker | undefined = new Worker(decoderWorkerUrl);
    const chunks: Float32Array[] = [];
    let settled = false;

    const cleanup = () => {
      decoderWorker?.terminate();
      decoderWorker = undefined;
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timer = window.setTimeout(() => fail(new Error('oggToPcm timeout')), DECODE_TIMEOUT_MS);

    decoderWorker.onerror = () => fail(new Error('ogg decoder worker failed'));

    decoderWorker.onmessage = (e) => {
      // eslint-disable-next-line no-null/no-null
      if (e.data === null) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        if (!total) {
          reject(new Error('oggToPcm produced empty audio'));
          return;
        }

        const samples = new Float32Array(total);
        let offset = 0;
        chunks.forEach((chunk) => {
          samples.set(chunk, offset);
          offset += chunk.length;
        });

        resolve({ samples, sampleRate: SAMPLE_RATE });
        return;
      }

      const buffers = e.data as Float32Array[];
      if (!buffers?.length) return;

      // Opus decoder may return interleaved channels as separate buffers; take mono (first channel).
      const mono = buffers[0];
      if (mono?.length) {
        chunks.push(mono);
      }
    };

    decoderWorker.postMessage({
      command: 'init',
      decoderSampleRate: SAMPLE_RATE,
      outputBufferSampleRate: SAMPLE_RATE,
    });

    decoderWorker.postMessage({
      command: 'decode',
      pages: typedArray,
    }, [typedArray.buffer]);
  });
}
