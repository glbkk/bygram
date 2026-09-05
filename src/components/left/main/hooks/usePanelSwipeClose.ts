import type { ElementRef } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { animateNumber, timingFunctions } from '../../../../util/animation';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';

import useLastCallback from '../../../../hooks/useLastCallback';

const EDGE_ZONE_PX = 28;
const CLAIM_DX_PX = 12;
const FAIL_VERTICAL_PX = 36;
const COMMIT_PROGRESS = 0.28;
const VELOCITY_COMMIT = 0.45;
const SNAP_MS = 120;
const EXCLUDED_SELECTOR = [
  '.Modal',
  '.Menu',
  '.RecipientPicker',
  '.media-viewer',
  'input',
  'textarea',
].join(', ');

/**
 * Edge swipe-right to close full-screen left panels (Music / Feed).
 * Uses its own listeners so iOS edge-threshold in captureEvents cannot block it.
 */
export default function usePanelSwipeClose(
  containerRef: ElementRef<HTMLElement>,
  isEnabled: boolean | undefined,
  onClose: NoneToVoidFunction,
) {
  const handleClose = useLastCallback(onClose);

  useEffect(() => {
    if (!IS_TOUCH_ENV || !isEnabled) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocityX = 0;
    let progress = 0;
    let cancelSnap: NoneToVoidFunction | undefined;
    let moveListenerAttached = false;

    const applyProgress = (next: number) => {
      progress = Math.max(0, Math.min(1, next));
      requestMutation(() => {
        container.style.transition = 'none';
        container.style.transform = `translate3d(${progress * 100}%, 0, 0)`;
      });
    };

    const clearInlineStyles = () => {
      requestMutation(() => {
        container.style.removeProperty('transition');
        container.style.removeProperty('transform');
      });
    };

    const detachMove = () => {
      if (!moveListenerAttached) return;
      container.removeEventListener('touchmove', onTouchMove);
      moveListenerAttached = false;
    };

    const attachNonPassiveMove = () => {
      if (moveListenerAttached) return;
      container.addEventListener('touchmove', onTouchMove, { passive: false });
      moveListenerAttached = true;
    };

    const resetSession = () => {
      tracking = false;
      dragging = false;
      progress = 0;
      velocityX = 0;
      detachMove();
    };

    const snapTo = (to: number, onDone: NoneToVoidFunction) => {
      cancelSnap?.();
      const from = progress;
      cancelSnap = animateNumber({
        from,
        to,
        duration: SNAP_MS,
        timing: timingFunctions.easeOutCubic,
        onUpdate: (value) => applyProgress(value),
        onEnd: (canceled) => {
          cancelSnap = undefined;
          if (!canceled) onDone();
        },
      });
    };

    const finishCommit = () => {
      clearInlineStyles();
      resetSession();
      handleClose();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE_PX) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(EXCLUDED_SELECTOR)) return;

      cancelSnap?.();
      cancelSnap = undefined;

      tracking = true;
      dragging = false;
      startX = touch.clientX;
      startY = touch.clientY;
      lastX = touch.clientX;
      lastT = performance.now();
      velocityX = 0;
      progress = 0;
      attachNonPassiveMove();
    };

    function onTouchMove(e: TouchEvent) {
      if (!tracking || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      velocityX = (touch.clientX - lastX) / dt;
      lastX = touch.clientX;
      lastT = now;

      if (!dragging) {
        if (dy > FAIL_VERTICAL_PX && dy > Math.abs(dx)) {
          resetSession();
          clearInlineStyles();
          return;
        }
        if (dx < CLAIM_DX_PX) return;
        dragging = true;
      }

      e.preventDefault();
      applyProgress(dx / Math.max(1, container.clientWidth || window.innerWidth));
    }

    const onTouchEnd = () => {
      if (!tracking) return;

      const shouldCommit = dragging && (
        progress >= COMMIT_PROGRESS || velocityX >= VELOCITY_COMMIT
      );

      if (!dragging) {
        resetSession();
        return;
      }

      tracking = false;
      detachMove();

      if (shouldCommit) {
        finishCommit();
        return;
      }

      snapTo(0, () => {
        clearInlineStyles();
        resetSession();
      });
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      cancelSnap?.();
      detachMove();
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      clearInlineStyles();
    };
  }, [containerRef, handleClose, isEnabled]);
}
