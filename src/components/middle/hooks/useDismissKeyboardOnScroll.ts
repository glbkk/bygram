import { useEffect, useRef } from '../../../lib/teact/teact';

import type { ElementRef } from '../../../lib/teact/teact';

import { EDITABLE_INPUT_ID } from '../../../config';
import { isAnimatingScroll } from '../../../util/animateScroll';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';

// Matches Telegram iOS: a sharp drag / fling on the message list resigns the composer.
const VELOCITY_THRESHOLD_PX_PER_MS = 0.55;
const MIN_DELTA_PX = 20;
const DRAG_DISMISS_DELTA_PX = 36;
const MAX_SAMPLE_GAP_MS = 100;

function isComposerFocused() {
  const { activeElement } = document;
  return Boolean(activeElement && activeElement.id === EDITABLE_INPUT_ID);
}

function blurComposer() {
  const { activeElement } = document;
  if (activeElement instanceof HTMLElement && activeElement.id === EDITABLE_INPUT_ID) {
    activeElement.blur();
  }
}

export default function useDismissKeyboardOnScroll(
  containerRef: ElementRef<HTMLDivElement>,
  isEnabled = true,
) {
  const lastScrollTopRef = useRef<number>();
  const lastScrollTimeRef = useRef<number>();
  const isTouchingRef = useRef(false);

  useEffect(() => {
    if (!IS_TOUCH_ENV || !isEnabled) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const resetSamples = () => {
      lastScrollTopRef.current = container.scrollTop;
      lastScrollTimeRef.current = performance.now();
    };

    const handleTouchStart = () => {
      isTouchingRef.current = true;
      resetSamples();
    };

    const handleTouchEnd = () => {
      isTouchingRef.current = false;
    };

    const handleScroll = () => {
      // Ignore programmatic scrolls (send, focus, open chat) — only user gestures dismiss.
      if (!isTouchingRef.current || isAnimatingScroll(container)) {
        lastScrollTopRef.current = container.scrollTop;
        lastScrollTimeRef.current = performance.now();
        return;
      }

      if (!isComposerFocused() && !document.body.classList.contains('keyboard-visible')) {
        return;
      }

      const now = performance.now();
      const scrollTop = container.scrollTop;
      const lastTop = lastScrollTopRef.current;
      const lastTime = lastScrollTimeRef.current;

      lastScrollTopRef.current = scrollTop;
      lastScrollTimeRef.current = now;

      if (lastTop === undefined || lastTime === undefined) {
        return;
      }

      const dt = now - lastTime;
      if (dt <= 0 || dt > MAX_SAMPLE_GAP_MS) {
        return;
      }

      const dy = Math.abs(scrollTop - lastTop);
      if (dy < MIN_DELTA_PX) {
        return;
      }

      const velocity = dy / dt;
      const shouldDismiss = velocity >= VELOCITY_THRESHOLD_PX_PER_MS
        || dy >= DRAG_DISMISS_DELTA_PX;

      if (shouldDismiss) {
        blurComposer();
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, isEnabled]);
}
