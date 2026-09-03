import type { IDimensions } from '../types';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { throttle } from './schedulers';

const WINDOW_ORIENTATION_CHANGE_THROTTLE_MS = 100;
const WINDOW_RESIZE_THROTTLE_MS = 250;

let initialHeight = window.innerHeight;
let currentWindowSize = updateSizes();

const handleResize = throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_RESIZE_THROTTLE_MS, true);

const handleOrientationChange = throttle(() => {
  initialHeight = window.innerHeight;
  handleResize();
}, WINDOW_ORIENTATION_CHANGE_THROTTLE_MS, false);

// The iOS keyboard animates over roughly 300ms and `visualViewport` reports it at most once per frame.
// Throttling that stream makes the composer visibly step behind the keyboard, so it runs unthrottled
// and relies on `requestMutation` inside `updateSizes` to coalesce the CSS variable writes per frame.
const handleVisualViewportChange = () => {
  currentWindowSize = updateSizes();
};

window.addEventListener('orientationchange', handleOrientationChange);
if (window.visualViewport) {
  // Prefer visualViewport on all platforms that expose it (iOS + modern Android Chrome).
  // Throttling made the composer lag behind the keyboard; coalesce via requestMutation in updateSizes.
  window.visualViewport.addEventListener('resize', handleVisualViewportChange);
  window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
} else {
  window.addEventListener('resize', handleResize);
}

export function updateSizes(): IDimensions {
  const hasVisualViewport = Boolean(window.visualViewport);
  const height = hasVisualViewport
    ? (window.visualViewport!.height || window.innerHeight)
    : window.innerHeight;

  requestMutation(() => {
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    if (hasVisualViewport) {
      document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
      document.documentElement.style.setProperty(
        '--visual-viewport-offset-top',
        `${window.visualViewport?.offsetTop || 0}px`,
      );
    }
  });

  return {
    width: window.innerWidth,
    height,
  };
}

const windowSize = {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

export default windowSize;
