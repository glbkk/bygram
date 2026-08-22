import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { getMainUsername, getUserFullName } from '../../global/helpers';
import { selectUser } from '../../global/selectors';
import { getBygramSettings, subscribeBygramSettings } from '../../util/bygramArchive';
import {
  getBygramStreak,
  markBygramStreakMilestoneOffered,
  shouldOfferBygramStreakMilestone,
  subscribeToBygramStreak,
} from '../../util/bygramStreak';
import {
  type BygramStreakStoryTemplate, createBygramStreakStoryFile,
} from '../../util/bygramStreakStory';
import { callApi } from '../../api/gramjs';

import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Avatar from './Avatar';
import Icon from './icons/Icon';

import styles from './BygramStreakBadge.module.scss';

type OwnProps = {
  accountId: string;
  peerId: string;
  shouldOfferMilestone?: boolean;
};

const UPDATE_INTERVAL = 60 * 1000;
const MAX_CUSTOM_DAYS = 99999;
const STORY_TEMPLATES: Array<{ id: BygramStreakStoryTemplate; label: string }> = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'aurora', label: 'Аврора' },
  { id: 'midnight', label: 'Ночная' },
];

const BygramStreakBadge = ({ accountId, peerId, shouldOfferMilestone }: OwnProps) => {
  const { showNotification } = getActions();
  const [streak, setStreak] = useState(() => getBygramStreak(accountId, peerId));
  const [isEnabled, setIsEnabled] = useState(() => getBygramSettings().isChatStreakEnabled);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMilestone, setIsMilestone] = useState(false);
  const [customDays, setCustomDays] = useState(() => String(streak?.days || 1));
  const [storyTemplate, setStoryTemplate] = useState<BygramStreakStoryTemplate>('telegram');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string>();

  useEffect(() => {
    const update = () => setStreak(getBygramStreak(accountId, peerId));
    update();

    const unsubscribe = subscribeToBygramStreak(accountId, peerId, update);
    const unsubscribeSettings = subscribeBygramSettings((settings) => {
      setIsEnabled(settings.isChatStreakEnabled);
    });
    const interval = window.setInterval(update, UPDATE_INTERVAL);
    return () => {
      unsubscribe();
      unsubscribeSettings();
      window.clearInterval(interval);
    };
  }, [accountId, peerId]);

  useEffect(() => {
    if (!isEnabled || !shouldOfferMilestone || !streak
      || !shouldOfferBygramStreakMilestone(accountId, peerId, streak.days)) return;

    markBygramStreakMilestoneOffered(accountId, peerId, streak.days);
    setCustomDays(String(streak.days));
    setIsMilestone(true);
    setIsModalOpen(true);
  }, [accountId, isEnabled, peerId, shouldOfferMilestone, streak]);

  const handleOpen = useLastCallback((event: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    setCustomDays(String(streak?.days || 1));
    setIsMilestone(false);
    setPublishError(undefined);
    setIsModalOpen(true);
  });

  const handleClose = useLastCallback(() => {
    if (!isPublishing) setIsModalOpen(false);
  });

  const handleDaysChange = useLastCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value.replace(/\D/g, '').slice(0, 5);
    setCustomDays(value);
  });

  const handlePublish = useLastCallback(async () => {
    const days = Math.min(MAX_CUSTOM_DAYS, Math.max(1, Number(customDays) || 1));
    const global = getGlobal();
    const currentUser = selectUser(global, accountId);
    const peerUser = selectUser(global, peerId);
    if (!currentUser || !peerUser) {
      showNotification({ message: 'Не удалось загрузить данные пользователей' });
      return;
    }

    setCustomDays(String(days));
    setPublishError(undefined);
    setIsPublishing(true);
    try {
      const file = await createBygramStreakStoryFile(currentUser, peerUser, days, storyTemplate);
      const result = await callApi('publishBygramStreakStory', file);
      if (!result?.isSuccess) {
        const message = getStoryPublishError(result?.error);
        setPublishError(message);
        showNotification({ message });
        return;
      }
      setIsModalOpen(false);
      showNotification({ message: 'История опубликована для ваших контактов' });
    } catch {
      const message = 'Не удалось подготовить историю. Попробуйте ещё раз.';
      setPublishError(message);
      showNotification({ message });
    } finally {
      setIsPublishing(false);
    }
  });

  if (!isEnabled || !streak) return undefined;

  const global = getGlobal();
  const currentUser = selectUser(global, accountId);
  const peerUser = selectUser(global, peerId);
  const days = Math.min(MAX_CUSTOM_DAYS, Math.max(1, Number(customDays) || streak.days));
  const label = `Самолётик: ${streak.days} ${pluralizeDays(streak.days)}`;

  return (
    <>
      <button type="button" className={styles.root} title={label} aria-label={label} onClick={handleOpen}>
        <Icon name="send" className={styles.plane} />
        {streak.days}
      </button>
      {isModalOpen && (
        <Modal
          isOpen
          title={isMilestone ? `Юбилей — ${streak.days} ${pluralizeDays(streak.days)}!` : 'Самолётик bygram'}
          className={`${styles.modal} mobile-full-screen`}
          contentClassName={styles.modalContent}
          hasCloseButton
          onClose={handleClose}
        >
          <div className={styles.content}>
            <div className={styles.scrollArea}>
              <p className={styles.description}>
                Серия растёт, когда вы оба общаетесь каждый день, и исчезает через сутки без сообщений.
              </p>
              {currentUser && peerUser && (
                <div
                  className={`${styles.storyPreview} ${styles[`storyPreview_${storyTemplate}`]}`}
                  aria-label="Предпросмотр истории"
                >
                  <span className={styles.previewBrand}>bygram</span>
                  <strong>{`У нас уже ${days} ${pluralizeDays(days)}`}</strong>
                  <strong>самолётик в bygram!</strong>
                  <div className={styles.previewPeople}>
                    <PreviewUser user={currentUser} />
                    <div className={styles.previewCounter}>
                      <Icon name="send" />
                      <b>{days}</b>
                    </div>
                    <PreviewUser user={peerUser} />
                  </div>
                </div>
              )}
              <section className={styles.options}>
                <span className={styles.sectionLabel}>Оформление</span>
                <div className={styles.templatePicker} role="radiogroup" aria-label="Шаблон истории">
                  {STORY_TEMPLATES.map(({ id, label: templateLabel }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={storyTemplate === id}
                      className={storyTemplate === id ? styles.templateActive : undefined}
                      onClick={() => setStoryTemplate(id)}
                    >
                      {templateLabel}
                    </button>
                  ))}
                </div>
                <label className={styles.daysField}>
                  <span>Дней в серии</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={customDays}
                    aria-label="Число дней серии"
                    onChange={handleDaysChange}
                  />
                </label>
              </section>
            </div>
            <div className={styles.footer}>
              {publishError && <p className={styles.publishError} role="alert">{publishError}</p>}
              <Button
                className={styles.publishButton}
                isLoading={isPublishing}
                disabled={isPublishing}
                onClick={handlePublish}
              >
                Выложить историю
              </Button>
              <span className={styles.privacy}>Увидят все пользователи Telegram · 6 часов</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

function PreviewUser({ user }: { user: NonNullable<ReturnType<typeof selectUser>> }) {
  const username = getMainUsername(user);
  return (
    <div className={styles.previewUser}>
      <Avatar peer={user} size={64} />
      <span>{username ? `@${username}` : (getUserFullName(user) || 'Пользователь')}</span>
    </div>
  );
}

function pluralizeDays(days: number) {
  const mod100 = days % 100;
  const mod10 = days % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function getStoryPublishError(error?: string) {
  if (!error) return 'Telegram не ответил на запрос. Проверьте соединение и попробуйте ещё раз.';
  if (error === 'STORY_DAILY_LIMIT' || error === 'STORIES_TOO_MUCH') {
    return 'Достигнут дневной лимит историй Telegram.';
  }
  if (error === 'PREMIUM_ACCOUNT_REQUIRED') {
    return 'Для публикации этой истории Telegram требует Premium.';
  }
  if (error.startsWith('FLOOD_WAIT') || error.startsWith('STORY_SEND_FLOOD')) {
    return 'Telegram временно ограничил частые публикации. Попробуйте позже.';
  }
  if (error === 'STORY_NOT_MODIFIED') return 'Такая история уже опубликована.';
  return `Telegram отклонил публикацию: ${error}`;
}

export default memo(BygramStreakBadge);
