import { VIDEO_MUSIC_AUDIO_BITRATE } from '../../config';
import { runFFmpegJob } from './ffmpegRunner';

export const MIN_VIDEO_MUSIC_SEGMENT_SEC = 1;

export type VideoMusicSegment = {
  startSec: number;
  endSec: number;
};

export function getVideoMusicSegmentDuration(segment: VideoMusicSegment, videoDurationSec: number) {
  const requested = segment.endSec - segment.startSec;
  // The video is never stretched to fit the track, so a longer selection is simply cut off
  return Math.min(Math.max(requested, MIN_VIDEO_MUSIC_SEGMENT_SEC), videoDurationSec);
}

// Replaces the video's own sound with the chosen part of an audio file. The video stream is
// copied rather than re-encoded, which keeps this usable on a phone.
export function overlayVideoMusic(
  video: Blob,
  audio: Blob,
  segment: VideoMusicSegment,
  videoDurationSec: number,
): Promise<Blob> {
  const duration = getVideoMusicSegmentDuration(segment, videoDurationSec);

  return runFFmpegJob(async (ctx) => {
    const videoPath = ctx.reserve('music-video.mp4');
    const audioPath = ctx.reserve('music-track');
    const outputPath = ctx.reserve('music-output.mp4');

    await ctx.write(videoPath, video);
    await ctx.write(audioPath, audio);

    await ctx.exec([
      '-i', videoPath,
      // Placed before the audio input so the seek applies to it: ffmpeg then decodes only the
      // selected part of the track instead of reading it whole and trimming the result.
      '-ss', segment.startSec.toFixed(3),
      '-t', duration.toFixed(3),
      '-i', audioPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', String(VIDEO_MUSIC_AUDIO_BITRATE),
      '-ac', '2',
      '-ar', '44100',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const bytes = await ctx.read(outputPath);
    return new Blob([bytes], { type: 'video/mp4' });
  });
}
