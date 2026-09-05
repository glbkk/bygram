import { IS_IOS, IS_PWA } from './browser/windowEnvironment';

/** Typical Dynamic Island / notch status-bar inset when WebKit reports 0 (iOS 26.x PWA bug). */
const IOS_PWA_SAFE_AREA_TOP_FALLBACK_PX = 59;
const IOS_PWA_SAFE_AREA_BOTTOM_FALLBACK_PX = 34;

function readCssEnvPx(name: string): number {
  if (typeof window === 'undefined' || !window.CSS?.supports?.('padding-top: env(safe-area-inset-top)')) {
    return 0;
  }

  const probe = document.createElement('div');
  probe.style.cssText = `
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    padding-top: env(${name}, 0px);
  `;
  document.documentElement.appendChild(probe);
  const value = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return value;
}

/**
 * iOS home-screen PWAs use black-translucent status bar (content under Dynamic Island).
 * Some iOS 26.x builds report env(safe-area-inset-*) as 0 — fall back to hardware-sized insets.
 */
export function applyIosPwaSafeAreaInsets() {
  if (!IS_IOS || !IS_PWA) return;

  document.documentElement.classList.add('is-ios-pwa');
  document.body.classList.add('is-ios-pwa');

  const envTop = readCssEnvPx('safe-area-inset-top');
  const envBottom = readCssEnvPx('safe-area-inset-bottom');

  const top = envTop > 0 ? envTop : IOS_PWA_SAFE_AREA_TOP_FALLBACK_PX;
  const bottom = envBottom > 0 ? envBottom : IOS_PWA_SAFE_AREA_BOTTOM_FALLBACK_PX;

  document.documentElement.style.setProperty('--bygram-safe-area-top', `${top}px`);
  document.documentElement.style.setProperty('--bygram-safe-area-bottom', `${bottom}px`);
}
