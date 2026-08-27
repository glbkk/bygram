import type { ChangeEvent } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';

import type { VideoMusicSegment } from '../../../util/videoRecording/overlayVideoMusic';

import { MIN_VIDEO_MUSIC_SEGMENT_SEC } from '../../../util/videoRecording/overlayVideoMusic';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './BygramVideoMusicModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  file?: File;
  videoDurationSec: number;
  onApply: (segment: VideoMusicSegment) => void;
  onClose: NoneToVoidFunction;
};

type Handle = 'start' | 'end';

function formatTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const BygramVideoMusicModal = ({
  isOpen, file, videoDurationSec, onApply, onClose,
}: OwnProps) => {
  const lang = useOldLang();
  const trackRef = useRef<HTMLDivElement>();
  const audioRef = useRef<HTMLAudioElement>();
  const draggingRef = useRef<Handle>();

  const [trackDuration, setTrackDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  // A selection longer than the video cannot be heard in full, so it is not offered
  const maxSegment = Math.max(
    Math.min(videoDurationSec, trackDuration || videoDurationSec),
    MIN_VIDEO_MUSIC_SEGMENT_SEC,
  );

  const handleLoadedMetadata = useLastCallback((e: ChangeEvent<HTMLAudioElement>) => {
    const duration = e.currentTarget.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    setTrackDuration(duration);
    setStartSec(0);
    setEndSec(Math.min(duration, Math.max(videoDurationSec, MIN_VIDEO_MUSIC_SEGMENT_SEC)));
  });

  const stopPreview = useLastCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setIsPlaying(false);
  });

  useEffect(() => {
    if (!isOpen) stopPreview();
  }, [isOpen, stopPreview]);

  // The preview is scoped to the selection, so it has to be stopped at its end manually
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return undefined;

    const handleTimeUpdate = () => {
      if (audio.currentTime >= endSec) stopPreview();
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPlaying, endSec, stopPreview]);

  const handleTogglePreview = useLastCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      stopPreview();
      return;
    }
    audio.currentTime = startSec;
    void audio.play().then(() => setIsPlaying(true), () => setIsPlaying(false));
  });

  const applyHandlePosition = useLastCallback((handle: Handle, fraction: number) => {
    if (!trackDuration) return;
    const position = Math.min(Math.max(fraction, 0), 1) * trackDuration;

    if (handle === 'start') {
      const nextStart = Math.max(0, Math.min(position, trackDuration - MIN_VIDEO_MUSIC_SEGMENT_SEC));
      const lowestEnd = nextStart + MIN_VIDEO_MUSIC_SEGMENT_SEC;
      const highestEnd = Math.min(trackDuration, nextStart + maxSegment);
      setStartSec(nextStart);
      // The left handle drags the window along once it would outgrow the cap or overlap the right one
      setEndSec((prevEnd) => Math.min(Math.max(prevEnd, lowestEnd), highestEnd));
    } else {
      const lowestEnd = startSec + MIN_VIDEO_MUSIC_SEGMENT_SEC;
      const highestEnd = Math.min(trackDuration, startSec + maxSegment);
      setEndSec(Math.min(Math.max(position, lowestEnd), highestEnd));
    }
  });

  const handlePointerDown = useLastCallback((handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    stopPreview();
    draggingRef.current = handle;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  });

  const handlePointerMove = useLastCallback((e: React.PointerEvent) => {
    const handle = draggingRef.current;
    const track = trackRef.current;
    if (!handle || !track) return;
    const rect = track.getBoundingClientRect();
    applyHandlePosition(handle, (e.clientX - rect.left) / rect.width);
  });

  const handlePointerUp = useLastCallback(() => {
    draggingRef.current = undefined;
  });

  const handleApply = useLastCallback(() => {
    stopPreview();
    onApply({ startSec, endSec });
  });

  const startFraction = trackDuration ? startSec / trackDuration : 0;
  const endFraction = trackDuration ? endSec / trackDuration : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lang('BygramVideoMusicTitle')}
      hasCloseButton
      isSlim
    >
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
        />
      )}

      <div className={styles.fileName}>{file?.name}</div>

      <div
        ref={trackRef}
        className={styles.track}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={styles.selection}
          style={`left: ${startFraction * 100}%; right: ${(1 - endFraction) * 100}%`}
        />
        <div
          className={styles.handle}
          style={`left: ${startFraction * 100}%`}
          role="slider"
          tabIndex={0}
          aria-label={lang('BygramVideoMusicFrom')}
          aria-valuenow={Math.round(startSec)}
          onPointerDown={handlePointerDown('start')}
        />
        <div
          className={styles.handle}
          style={`left: ${endFraction * 100}%`}
          role="slider"
          tabIndex={0}
          aria-label={lang('BygramVideoMusicTo')}
          aria-valuenow={Math.round(endSec)}
          onPointerDown={handlePointerDown('end')}
        />
      </div>

      <div className={styles.readout}>
        <span>{`${formatTime(startSec)} – ${formatTime(endSec)}`}</span>
        <span className={styles.duration}>{formatTime(endSec - startSec)}</span>
      </div>

      <div className={styles.hint}>
        {lang('BygramVideoMusicHint')}
      </div>

      <div className={styles.actions}>
        <Button isText onClick={handleTogglePreview} disabled={!trackDuration}>
          {lang(isPlaying ? 'BygramVideoMusicStop' : 'BygramVideoMusicPreview')}
        </Button>
        <div className={styles.spacer} />
        <Button isText onClick={onClose}>{lang('Cancel')}</Button>
        <Button isText color="primary" onClick={handleApply} disabled={!trackDuration}>
          {lang('BygramVideoMusicApply')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(BygramVideoMusicModal);
