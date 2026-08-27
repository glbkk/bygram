import wasmURL from '@ffmpeg/core/wasm?url';
import coreURL from '@ffmpeg/core?url';
import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | undefined;
let loadPromise: Promise<void> | undefined;
let jobQueue = Promise.resolve();
let nextJobId = 0;

const LOAD_TIMEOUT_MS = 30000;
const EXEC_TIMEOUT_MS = 60000;
const OPERATION_GRACE_MS = 5000;

export type FFmpegJobContext = {
  // Returns a scratch path that is deleted once the job settles
  reserve: (suffix: string) => string;
  write: (path: string, blob: Blob) => Promise<void>;
  exec: (args: string[], timeoutMs?: number) => Promise<void>;
  read: (path: string) => Promise<Uint8Array<ArrayBuffer>>;
};

// The wasm core is tens of megabytes, so every caller shares one instance and one queue.
// Jobs never overlap: a second `exec` on a busy instance would fail, and two instances on a
// phone would double the memory footprint.
export function runFFmpegJob<T>(job: (ctx: FFmpegJobContext) => Promise<T>): Promise<T> {
  const run = jobQueue.then(() => execJob(job));
  jobQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function execJob<T>(job: (ctx: FFmpegJobContext) => Promise<T>) {
  const instance = await getFFmpeg();
  const jobId = ++nextJobId;
  const scratchPaths: string[] = [];

  const ctx: FFmpegJobContext = {
    reserve: (suffix) => {
      const path = `bygram-${jobId}-${scratchPaths.length}-${suffix}`;
      scratchPaths.push(path);
      return path;
    },
    write: async (path, blob) => {
      await instance.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    },
    exec: async (args, timeoutMs = EXEC_TIMEOUT_MS) => {
      const exitCode = await withTimeout(
        instance.exec(args, timeoutMs),
        timeoutMs + OPERATION_GRACE_MS,
        () => resetFFmpeg(instance),
      );
      if (exitCode !== 0) throw new Error(`ffmpeg exited with code ${exitCode}`);
    },
    read: async (path) => {
      const output = await instance.readFile(path);
      if (typeof output === 'string') throw new Error('ffmpeg returned text instead of binary data');
      // Copied out of the wasm heap on purpose: that view can sit on a SharedArrayBuffer, which is
      // not a valid `BlobPart`, and it stops being safe to read once the heap is reused.
      const bytes = new Uint8Array(output.byteLength);
      bytes.set(output);
      return bytes;
    },
  };

  try {
    return await job(ctx);
  } catch (err) {
    resetFFmpeg(instance);
    throw err;
  } finally {
    await Promise.allSettled(scratchPaths.map((path) => instance.deleteFile(path)));
  }
}

async function getFFmpeg() {
  if (!ffmpeg) ffmpeg = new FFmpeg();
  if (!loadPromise) {
    const instance = ffmpeg;
    loadPromise = withTimeout(instance.load({ coreURL, wasmURL }), LOAD_TIMEOUT_MS, () => {
      resetFFmpeg(instance);
    }).then(() => undefined).catch((err) => {
      resetFFmpeg(instance);
      throw err;
    });
  }
  await loadPromise;
  return ffmpeg;
}

function resetFFmpeg(instance: FFmpeg) {
  if (ffmpeg !== instance) return;
  instance.terminate();
  ffmpeg = undefined;
  loadPromise = undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: NoneToVoidFunction) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      onTimeout();
      reject(new Error('ffmpeg processing timed out'));
    }, timeoutMs);
    promise.then((result) => {
      clearTimeout(timeoutId);
      resolve(result);
    }, (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}
