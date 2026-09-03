import { IS_TOUCH_ENV } from './browser/windowEnvironment';

/** Soft impact — Telegram iOS–like tick (not a long buzz). */
export const vibrateShort = () => {
  if (!IS_TOUCH_ENV) return;
  navigator.vibrate?.(12);
};

/** Slightly stronger confirm (send / swipe-reply commit). */
export const vibrateImpact = () => {
  if (!IS_TOUCH_ENV) return;
  navigator.vibrate?.(18);
};
