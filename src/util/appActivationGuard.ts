import type { StoryViewerOrigin } from '../types';

const STORY_OPEN_GUARD_MS = 900;

let lastActivationAt = performance.now();

function markActivated() {
  lastActivationAt = performance.now();
}

window.addEventListener('pageshow', markActivated);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    markActivated();
  }
});

export function canOpenStoryAfterActivation(origin?: StoryViewerOrigin) {
  return origin === undefined || performance.now() - lastActivationAt >= STORY_OPEN_GUARD_MS;
}
