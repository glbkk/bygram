import { memo, useEffect, useState } from '../../lib/teact/teact';

import {
  getBygramStreak, subscribeToBygramStreak,
} from '../../util/bygramStreak';

import styles from './BygramStreakBadge.module.scss';

type OwnProps = {
  accountId: string;
  peerId: string;
};

const UPDATE_INTERVAL = 60 * 1000;

const BygramStreakBadge = ({ accountId, peerId }: OwnProps) => {
  const [streak, setStreak] = useState(() => getBygramStreak(accountId, peerId));

  useEffect(() => {
    const update = () => setStreak(getBygramStreak(accountId, peerId));
    update();

    const unsubscribe = subscribeToBygramStreak(accountId, peerId, update);
    const interval = window.setInterval(update, UPDATE_INTERVAL);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [accountId, peerId]);

  if (!streak) return undefined;

  const label = `Серия общения: ${streak.days} дн.`;
  return (
    <span className={styles.root} title={label} aria-label={label}>
      <span className={styles.flame} aria-hidden>🔥</span>
      {streak.days}
    </span>
  );
};

export default memo(BygramStreakBadge);
