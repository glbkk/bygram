import { useEffect } from '../../../lib/teact/teact';

import type { ElementRef } from '../../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import { vibrateShort } from '../../../util/vibrate';

import useLastCallback from '../../../hooks/useLastCallback';

const EDGE_ZONE_PX = 28;
const BACK_THRESHOLD_PX = 72;
const FAIL_VERTICAL_PX = 36;
const EXCLUDED_SELECTOR = '.Composer, .SymbolMenu, .Modal, .Menu, .AttachmentModal, .media-viewer, .resize-handle';

/**
 * Telegram-like edge swipe to leave a chat. Uses a dedicated left-edge tracker
 * (not captureEvents) so iOS PWA can still go back without fighting Safari's
 * system edge gesture in the browser tab as hard.
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
    let triggered = false;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE_PX) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(EXCLUDED_SELECTOR)) return;

      tracking = true;
      triggered = false;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || triggered || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (dy > FAIL_VERTICAL_PX && dy > Math.abs(dx)) {
        tracking = false;
        return;
      }

      if (dx >= BACK_THRESHOLD_PX) {
        triggered = true;
        tracking = false;
        vibrateShort();
        handleBack();
      }
    };

    const onTouchEnd = () => {
      tracking = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [containerRef, handleBack, isEnabled]);
}
