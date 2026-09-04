import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect } from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animateNumber, timingFunctions } from '../../../util/animation';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import { markEdgeSwipeCommit } from '../../../util/bygramEdgeSwipe';
import { vibrateShort } from '../../../util/vibrate';

import useLastCallback from '../../../hooks/useLastCallback';

const EDGE_ZONE_PX = 24;
const CLAIM_DX_PX = 10;
const FAIL_VERTICAL_PX = 36;
const COMMIT_PROGRESS = 0.32;
const VELOCITY_COMMIT = 0.55;
const SNAP_MS = 140;
const EXCLUDED_SELECTOR = [
  '.Composer',
  '.SymbolMenu',
  '.Modal',
  '.Menu',
  '.AttachmentModal',
  '.media-viewer',
  '.resize-handle',
  '.RightColumn',
  '.StoryViewer',
].join(', ');

/**
 * Interactive edge swipe-back. Only #MiddleColumn follows the finger; the chat
 * list is revealed underneath without being transformed (avoids multi-second freezes).
 */
export default function useEdgeSwipeBack(
  containerRef: ElementRef<HTMLElement>,
  isEnabled: boolean | undefined,
  onBack: NoneToVoidFunction,
) {
  const handleBack = useLastCallback(onBack);

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
    let claimed = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocityX = 0;
    let progress = 0;
    let hasCrossedCommit = false;
    let cancelSnap: NoneToVoidFunction | undefined;
    let moveListenerAttached = false;

    const getMain = () => document.getElementById('Main');

    const applyProgress = (next: number) => {
      progress = Math.max(0, Math.min(1, next));
      requestMutation(() => {
        container.style.transition = 'none';
        container.style.transform = `translate3d(${progress * 100}vw, 0, 0)`;
        container.style.boxShadow = progress > 0
          ? `-8px 0 24px rgba(0,0,0,${0.18 * progress})`
          : '';
        document.body.style.setProperty('--edge-swipe-progress', String(progress));
      });
    };

    const clearInlineStyles = () => {
      const main = getMain();
      requestMutation(() => {
        container.style.removeProperty('transition');
        container.style.removeProperty('transform');
        container.style.removeProperty('box-shadow');
        document.body.style.removeProperty('--edge-swipe-progress');
        main?.classList.remove('is-edge-swiping');
        document.body.classList.remove('is-edge-swiping');
      });
    };

    const markDragging = () => {
      if (claimed) return;
      claimed = true;
      const main = getMain();
      requestMutation(() => {
        main?.classList.add('is-edge-swiping');
        document.body.classList.add('is-edge-swiping');
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
      claimed = false;
      hasCrossedCommit = false;
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
      markEdgeSwipeCommit();
      const main = getMain();
      requestMutation(() => {
        main?.classList.add('history-animation-disabled');
      });
      applyProgress(1);
      handleBack();

      const startedAt = performance.now();
      const settle = () => {
        const ready = Boolean(main?.classList.contains('left-column-open'))
          || performance.now() - startedAt > 120;
        if (!ready) {
          requestAnimationFrame(settle);
          return;
        }
        clearInlineStyles();
        resetSession();
        requestAnimationFrame(() => {
          requestMutation(() => {
            main?.classList.remove('history-animation-disabled');
          });
        });
      };
      requestAnimationFrame(settle);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (document.body.classList.contains('no-page-transitions')) return;
      if (document.getElementById('Main')?.classList.contains('right-column-open')) return;

      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE_PX) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(EXCLUDED_SELECTOR)) return;

      cancelSnap?.();
      cancelSnap = undefined;

      tracking = true;
      dragging = false;
      claimed = false;
      hasCrossedCommit = false;
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
        markDragging();
      }

      e.preventDefault();
      applyProgress(dx / Math.max(1, window.innerWidth));

      if (!hasCrossedCommit && progress >= COMMIT_PROGRESS) {
        hasCrossedCommit = true;
        vibrateShort();
      }
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
        vibrateShort();
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
  }, [containerRef, handleBack, isEnabled]);
}
