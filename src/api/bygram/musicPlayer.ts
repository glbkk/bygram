import { getActions } from '../../global';

import type { BygramMusicTrack } from './musicTypes';

import { registerExternalAudioPauseHandler, stopCurrentAudio } from '../../util/audioPlayer';
import { bygramMusicApi } from './serverlessMusic';

const HEARTBEAT_INTERVAL_MS = 10_000;

export type BygramMusicQueueSource = (
  'daily' | 'wave' | 'track-wave' | 'recent' | 'favorites' | 'search' | 'album' | 'playlist'
);
export type BygramMusicRepeatMode = 'off' | 'track' | 'queue';

export type BygramMusicPlayerState = {
  track?: BygramMusicTrack;
  queue: BygramMusicTrack[];
  queueIndex: number;
  source: BygramMusicQueueSource;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  repeatMode: BygramMusicRepeatMode;
  isLiked: boolean;
  error?: string;
};

const INITIAL_STATE: BygramMusicPlayerState = {
  queue: [],
  queueIndex: -1,
  source: 'search',
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  repeatMode: 'off',
  isLiked: false,
};

class BygramMusicPlayer {
  private readonly audio = new Audio();
  private readonly listeners = new Set<NoneToVoidFunction>();
  private state: BygramMusicPlayerState = INITIAL_STATE;
  private playId?: string;
  private generation = 0;
  private readonly likedTrackIds = new Set<string>();

  constructor() {
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', '');
    this.audio.ontimeupdate = () => {
      this.patch({
        position: this.audio.currentTime,
        duration: finiteDuration(this.audio.duration, this.state.track?.durationSeconds),
      });
      this.updateMediaPosition();
    };
    this.audio.onwaiting = () => this.patch({ isLoading: true });
    this.audio.onplaying = () => {
      this.patch({ isPlaying: true, isLoading: false, error: undefined });
      this.reportProgress(true);
    };
    this.audio.onpause = () => {
      this.patch({ isPlaying: false });
      this.reportProgress(false);
    };
    this.audio.onended = () => {
      this.patch({ isPlaying: false, position: this.state.duration });
      this.reportProgress(false, { completed: true });
      if (this.state.repeatMode === 'track') {
        void this.playAt(this.state.queueIndex, this.state.queue, this.state.source, false);
      } else if (this.state.queueIndex < this.state.queue.length - 1) {
        void this.next(false);
      } else if (this.state.repeatMode === 'queue' && this.state.queue.length) {
        void this.playAt(0, this.state.queue, this.state.source, false);
      }
    };
    this.audio.onerror = () => this.patch({
      isPlaying: false,
      isLoading: false,
      error: 'Не удалось воспроизвести трек',
    });

    window.setInterval(() => {
      if (this.playId) this.reportProgress(!this.audio.paused);
    }, HEARTBEAT_INTERVAL_MS);
    registerExternalAudioPauseHandler(() => {
      if (!this.audio.paused) this.audio.pause();
    });
    this.configureMediaSession();
  }

  getState() {
    return this.state;
  }

  subscribe(listener: NoneToVoidFunction) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async play(
    track: BygramMusicTrack,
    source: BygramMusicQueueSource,
    queue: BygramMusicTrack[],
  ) {
    const normalizedQueue = queue.some((item) => item.id === track.id) ? queue : [track, ...queue];
    const index = normalizedQueue.findIndex((item) => item.id === track.id);
    if (this.state.track?.id === track.id && this.audio.src) {
      this.toggle();
      return;
    }
    await this.playAt(index, normalizedQueue, source, true);
  }

  toggle() {
    if (!this.state.track) return;
    if (this.audio.paused) {
      stopCurrentAudio();
      getActions().closeAudioPlayer();
      void this.audio.play().catch(() => this.patch({
        isLoading: false,
        error: 'Нажмите ещё раз, чтобы продолжить воспроизведение',
      }));
    } else {
      this.audio.pause();
    }
  }

  async next(markSkipped = true) {
    const nextIndex = this.state.queueIndex + 1;
    if (nextIndex >= this.state.queue.length) {
      if (this.state.repeatMode === 'queue' && this.state.queue.length) {
        await this.playAt(0, this.state.queue, this.state.source, markSkipped);
      }
      return;
    }
    await this.playAt(nextIndex, this.state.queue, this.state.source, markSkipped);
  }

  async previous() {
    if (this.audio.currentTime > 4 || this.state.queueIndex <= 0) {
      if (this.audio.currentTime <= 4 && this.state.queueIndex === 0
        && this.state.repeatMode === 'queue' && this.state.queue.length > 1) {
        await this.playAt(this.state.queue.length - 1, this.state.queue, this.state.source, true);
        return;
      }
      this.seekTo(0);
      return;
    }
    await this.playAt(this.state.queueIndex - 1, this.state.queue, this.state.source, true);
  }

  seekTo(position: number) {
    const duration = this.state.duration || this.state.track?.durationSeconds || 0;
    const nextPosition = Math.max(0, Math.min(position, duration));
    this.audio.currentTime = nextPosition;
    this.patch({ position: nextPosition });
    this.updateMediaPosition();
  }

  cycleRepeatMode() {
    const repeatMode = this.state.repeatMode === 'off'
      ? 'track' : this.state.repeatMode === 'track' ? 'queue' : 'off';
    this.patch({ repeatMode });
  }

  syncLikedIds(ids: Iterable<string>) {
    this.likedTrackIds.clear();
    for (const id of ids) this.likedTrackIds.add(id);
    this.patch({ isLiked: Boolean(this.state.track && this.likedTrackIds.has(this.state.track.id)) });
  }

  replaceQueue(source: BygramMusicQueueSource, queue: BygramMusicTrack[]) {
    const trackId = this.state.track?.id;
    if (!trackId) return;
    const queueIndex = queue.findIndex((track) => track.id === trackId);
    if (queueIndex < 0) return;
    this.patch({ source, queue: [...queue], queueIndex });
  }

  reflectLiked(trackId: string, liked: boolean) {
    if (liked) this.likedTrackIds.add(trackId);
    else this.likedTrackIds.delete(trackId);
    if (this.state.track?.id === trackId) this.patch({ isLiked: liked });
  }

  async toggleLiked() {
    const track = this.state.track;
    if (!track) return;
    const liked = !this.state.isLiked;
    this.reflectLiked(track.id, liked);
    try {
      await bygramMusicApi.setMusicLiked(track.id, liked);
    } catch {
      this.reflectLiked(track.id, !liked);
    }
  }

  stop() {
    this.generation += 1;
    this.reportProgress(false, { skipped: !this.audio.ended });
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.playId = undefined;
    this.state = INITIAL_STATE;
    this.emit();
    // eslint-disable-next-line no-null/no-null
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }

  private async playAt(
    index: number,
    queue: BygramMusicTrack[],
    source: BygramMusicQueueSource,
    markPreviousSkipped: boolean,
  ) {
    const track = queue[index];
    if (!track) return;
    const generation = ++this.generation;
    if (this.playId) this.reportProgress(false, { skipped: markPreviousSkipped && !this.audio.ended });
    this.audio.pause();
    this.playId = undefined;
    this.patch({
      track,
      queue: [...queue],
      queueIndex: index,
      source,
      isPlaying: false,
      isLoading: true,
      position: 0,
      duration: track.durationSeconds,
      isLiked: this.likedTrackIds.has(track.id),
      error: undefined,
    });
    this.updateMediaMetadata(track);

    try {
      const play = await bygramMusicApi.startMusicPlay(track.id);
      if (generation !== this.generation) return;
      this.playId = play.id;
      this.audio.src = bygramMusicApi.getMusicAudioUrl(play.streamUrl);
      stopCurrentAudio();
      getActions().closeAudioPlayer();
      await this.audio.play();
    } catch {
      if (generation === this.generation) {
        this.patch({ isPlaying: false, isLoading: false, error: 'Не удалось загрузить трек' });
      }
    }
  }

  private reportProgress(
    isPlaying: boolean,
    flags: { completed?: boolean; skipped?: boolean } = {},
  ) {
    if (!this.playId) return;
    void isPlaying;
    void flags;
    void bygramMusicApi.updateMusicPlay();
  }

  private patch(patch: Partial<BygramMusicPlayerState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private configureMediaSession() {
    if (!('mediaSession' in navigator)) return;
    (['seekbackward', 'seekforward'] as MediaSessionAction[]).forEach((action) => {
      try {
        // Media Session requires null (not undefined) to remove an existing handler.
        // eslint-disable-next-line no-null/no-null
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // Older Safari versions expose MediaSession but support only a subset of actions.
      }
    });
    const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => this.toggle(),
      pause: () => this.toggle(),
      nexttrack: () => void this.next(),
      previoustrack: () => void this.previous(),
      seekto: (details) => this.seekTo(details.seekTime || 0),
    };
    Object.entries(actions).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        // Older Safari versions expose MediaSession but support only a subset of actions.
      }
    });
  }

  private updateMediaMetadata(track: BygramMusicTrack) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'ByGram Music',
      artwork: track.artworkUrl ? [{ src: new URL(track.artworkUrl, window.location.origin).toString() }] : undefined,
    });
  }

  private updateMediaPosition() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const duration = finiteDuration(this.audio.duration, this.state.track?.durationSeconds);
    if (!duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.audio.playbackRate,
        position: Math.min(this.audio.currentTime, duration),
      });
    } catch {
      // Safari may reject position updates while media metadata is changing.
    }
  }
}

function finiteDuration(duration: number, fallback = 0) {
  return Number.isFinite(duration) && duration > 0 ? duration : fallback;
}

export const bygramMusicPlayer = new BygramMusicPlayer();
