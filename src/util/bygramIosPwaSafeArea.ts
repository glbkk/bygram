import { IS_IOS, IS_PWA } from './browser/windowEnvironment';

/** Typical Dynamic Island / notch inset when WebKit reports env() as 0. */
const IOS_PWA_SAFE_AREA_TOP_FALLBACK_PX = 59;
/** Home indicator inset when WebKit reports env() as 0. */
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
 * iOS home-screen PWAs use black-translucent status bar.
 * When WebKit reports real safe-area insets, do nothing — existing env() padding is enough.
 * Only if both insets are 0 (known PWA bug), apply pixel fallbacks without overlay strips.
 */
export function applyIosPwaSafeAreaInsets() {
  if (!IS_IOS || !IS_PWA) return;

  document.documentElement.classList.add('is-ios-pwa');
  document.body.classList.add('is-ios-pwa');

  const envTop = readCssEnvPx('safe-area-inset-top');
  const envBottom = readCssEnvPx('safe-area-inset-bottom');

  // Normal iPhone 15 / 16 / 17: trust WebKit — never invent extra bottom chrome.
  if (envTop > 0 || envBottom > 0) {
    document.documentElement.classList.remove('is-ios-pwa-env-broken');
    document.documentElement.style.removeProperty('--bygram-safe-area-top');
    document.documentElement.style.removeProperty('--bygram-safe-area-bottom');
    return;
  }

  document.documentElement.classList.add('is-ios-pwa-env-broken');
  document.documentElement.style.setProperty('--bygram-safe-area-top', `${IOS_PWA_SAFE_AREA_TOP_FALLBACK_PX}px`);
  document.documentElement.style.setProperty(
    '--bygram-safe-area-bottom',
    `${IOS_PWA_SAFE_AREA_BOTTOM_FALLBACK_PX}px`,
  );
}
