import wasmURL from '@ffmpeg/core/wasm?url';
import coreURL from '@ffmpeg/core?url';
import { FFmpeg } from '@ffmpeg/ffmpeg';

import { ROUND_AUDIO_BITRATE, ROUND_VIDEO_BITRATE, ROUND_VIDEO_RECORDING_SIZE } from '../../config';

let ffmpeg: FFmpeg | undefined;
let loadPromise: Promise<void> | undefined;
let conversionQueue = Promise.resolve();
let nextFileId = 0;

export function prepareRoundVideo(blob: Blob): Promise<Blob> {
  const conversion = conversionQueue.then(() => convertToRoundVideo(blob));
  conversionQueue = conversion.then(() => undefined, () => undefined);
  return conversion;
}

async function convertToRoundVideo(blob: Blob) {
  const instance = await getFFmpeg();
  const fileId = ++nextFileId;
  const inputPath = `round-input-${fileId}.mp4`;
  const outputPath = `round-output-${fileId}.mp4`;
  const videoFilter = `crop=min(iw\\,ih):min(iw\\,ih),scale=${ROUND_VIDEO_RECORDING_SIZE}`
    + `:${ROUND_VIDEO_RECORDING_SIZE},setsar=1,fps=30`;

  try {
    await instance.writeFile(inputPath, new Uint8Array(await blob.arrayBuffer()));
    const exitCode = await instance.exec([
      '-i', inputPath,
      '-t', '60',
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-vf', videoFilter,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-pix_fmt', 'yuv420p',
      '-b:v', String(ROUND_VIDEO_BITRATE),
      '-c:a', 'aac',
      '-b:a', String(ROUND_AUDIO_BITRATE),
      '-ac', '1',
      '-ar', '48000',
      '-movflags', '+faststart',
      outputPath,
    ]);
    if (exitCode !== 0) throw new Error(`Round video conversion failed with code ${exitCode}`);

    const output = await instance.readFile(outputPath);
    if (typeof output === 'string') throw new Error('Round video conversion returned invalid data');
    const bytes = new Uint8Array(output);
    return new Blob([bytes.buffer], { type: 'video/mp4' });
  } finally {
    await Promise.allSettled([
      instance.deleteFile(inputPath),
      instance.deleteFile(outputPath),
    ]);
  }
}

async function getFFmpeg() {
  if (!ffmpeg) ffmpeg = new FFmpeg();
  if (!loadPromise) {
    loadPromise = ffmpeg.load({ coreURL, wasmURL }).then(() => undefined);
  }
  await loadPromise;
  return ffmpeg;
}
