import { IS_IOS, IS_TOUCH_ENV } from './browser/windowEnvironment';

/** Soft impact — Telegram iOS–like tick (not a long buzz). */
export const vibrateShort = () => {
  if (!IS_TOUCH_ENV) return;

  try {
    // Vibration API is a no-op on iOS Safari/PWA; still call for Android/Chrome.
    if (!IS_IOS) {
      navigator.vibrate?.(12);
    }
  } catch {
    // Ignore unsupported vibrate implementations.
  }
};

/** Slightly stronger confirm (send / swipe-reply commit). */
export const vibrateImpact = () => {
  if (!IS_TOUCH_ENV) return;

  try {
    if (!IS_IOS) {
      navigator.vibrate?.(18);
    }
  } catch {
    // Ignore unsupported vibrate implementations.
  }
};
