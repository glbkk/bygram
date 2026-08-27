import { ROUND_AUDIO_BITRATE, ROUND_VIDEO_BITRATE, ROUND_VIDEO_RECORDING_SIZE } from '../../config';
import { runFFmpegJob } from './ffmpegRunner';

export function prepareRoundVideo(blob: Blob): Promise<Blob> {
  return runFFmpegJob(async (ctx) => {
    const inputPath = ctx.reserve('round-input.mp4');
    const outputPath = ctx.reserve('round-output.mp4');
    const videoFilter = `crop=min(iw\\,ih):min(iw\\,ih),scale=${ROUND_VIDEO_RECORDING_SIZE}`
      + `:${ROUND_VIDEO_RECORDING_SIZE},setsar=1,fps=30`;

    await ctx.write(inputPath, blob);
    await ctx.exec([
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

    const bytes = await ctx.read(outputPath);
    return new Blob([bytes], { type: 'video/mp4' });
  });
}
