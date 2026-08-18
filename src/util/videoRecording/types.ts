export type Result = {
  blob: Blob;
  duration: number;
  durationMs: number;
  width: number;
  height: number;
};

export type CameraFacingMode = 'user' | 'environment';

export type ActiveVideoRecording = {
  previewStream: MediaStream;
  switchCamera: () => Promise<CameraFacingMode>;
  stop: () => Promise<Result>;
  cancel: () => void;
  pause: () => Promise<void>;
  resume: () => void;
  whenReady: Promise<void>;
  getElapsedMs: () => number;
  getProfilePeaks: () => number[];
  getPlaybackMedia?: () => Promise<HTMLVideoElement>;
  getPlaybackEl: () => HTMLVideoElement | undefined;
  destroyPlayback: () => void;
};

export type VideoRecorderEngine = {
  finalize: () => Promise<Blob>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
};

export type SnapshotRecorder = {
  flushAndPause: () => Promise<void>;
  resume: () => void;
  finish: () => void;
  getBlob: () => Blob;
};
