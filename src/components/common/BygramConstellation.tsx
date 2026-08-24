import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { getUserFullName } from '../../global/helpers';
import { selectUser } from '../../global/selectors';
import { getArchivedChatMessages } from '../../util/bygramArchive';
import {
  type BygramConstellationDay,
  bygramConstellationRepository,
  getBygramConstellationSeed,
  subscribeBygramConstellation,
} from '../../util/bygramConstellation';

import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import Avatar from './Avatar';
import BygramConstellationCanvas from './BygramConstellationCanvas';
import Icon from './icons/Icon';

import styles from './BygramConstellation.module.scss';

type OwnProps = {
  accountId: string;
  peerId: string;
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const BygramConstellation = ({ accountId, peerId, isOpen, onClose }: OwnProps) => {
  const [days, setDays] = useState<BygramConstellationDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<BygramConstellationDay>();
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const loadDays = useLastCallback(async () => {
    setDays(await bygramConstellationRepository.getDays(accountId, peerId));
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    let isCancelled = false;
    setIsLoading(true);
    setSelectedDay(undefined);

    void (async () => {
      try {
        const archived = await getArchivedChatMessages(peerId);
        await bygramConstellationRepository.importMessages(
          accountId,
          peerId,
          archived.map(({ message }) => message),
        );
        if (!isCancelled) await loadDays();
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    })();

    const unsubscribe = subscribeBygramConstellation(accountId, peerId, () => {
      if (!isCancelled) void loadDays();
    });
    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [accountId, isOpen, loadDays, peerId]);

  const handleOpenMessages = useLastCallback(() => {
    if (!selectedDay?.firstMessageId) return;
    onClose();
    getActions().focusMessage({ chatId: peerId, messageId: selectedDay.firstMessageId });
  });

  const global = getGlobal();
  const currentUser = selectUser(global, accountId);
  const peerUser = selectUser(global, peerId);
  const seed = getBygramConstellationSeed(accountId, peerId);

  return (
    <Modal
      isOpen={isOpen}
      title="Наше созвездие"
      className={`${styles.modal} mobile-full-screen`}
      contentClassName={styles.modalContent}
      hasCloseButton
      onClose={onClose}
    >
      <div className={styles.root}>
        <div className={styles.ambient} />
        <div className={styles.people}>
          {currentUser && <Avatar peer={currentUser} size={32} />}
          <span className={styles.connectionLine} />
          {peerUser && <Avatar peer={peerUser} size={32} />}
          <div className={styles.peopleText}>
            <strong>{days.length ? `${days.length} ${pluralizeStars(days.length)}` : 'Созвездие общения'}</strong>
            <span>{formatPeople(currentUser, peerUser)}</span>
          </div>
        </div>

        <div className={styles.canvasWrap}>
          {days.length > 0 && (
            <BygramConstellationCanvas
              days={days}
              seed={seed}
              selectedDate={selectedDay?.date}
              resetToken={resetToken}
              onSelect={setSelectedDay}
            />
          )}
          {isLoading && (
            <div className={styles.loading}>
              <span />
              <p>Собираем ваше созвездие…</p>
            </div>
          )}
          {!isLoading && !days.length && (
            <div className={styles.empty}>
              <Icon name="favorite" />
              <strong>Первая звезда появится после общения</strong>
              <span>Один активный день — одна звезда. Всё хранится только на этом устройстве.</span>
            </div>
          )}
          {days.length > 0 && (
            <>
              <div className={styles.timeDirection}>
                <Icon name="arrow-left" />
                <span>прошлое</span>
                <i />
                <span>сейчас</span>
                <Icon name="arrow-right" />
              </div>
              <button
                type="button"
                className={styles.nowButton}
                aria-label="Вернуться к новым звёздам"
                onClick={() => {
                  setSelectedDay(undefined);
                  setResetToken((value) => value + 1);
                }}
              >
                <Icon name="location" />
                К новым
              </button>
            </>
          )}
        </div>

        {selectedDay && (
          <DayMemory day={selectedDay} onOpenMessages={handleOpenMessages} onClose={() => setSelectedDay(undefined)} />
        )}
      </div>
    </Modal>
  );
};

function DayMemory({
  day, onOpenMessages, onClose,
}: {
  day: BygramConstellationDay;
  onOpenMessages: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}) {
  type MemoryRow = {
    icon: 'send' | 'message' | 'microphone' | 'camera' | 'animations' | 'gift' | 'diamond';
    text: string;
  };
  const rows: Array<MemoryRow | undefined> = [
    day.planeStreak ? {
      icon: 'send',
      text: `Самолётик — ${day.planeStreak} ${pluralizeDays(day.planeStreak)}`,
    } : undefined,
    day.messages ? {
      icon: 'message',
      text: `${day.messages} ${pluralizeMessages(day.messages)}`,
    } : undefined,
    day.voiceMessages ? {
      icon: 'microphone',
      text: `${day.voiceMessages} ${pluralizeVoice(day.voiceMessages)}`,
    } : undefined,
    day.roundVideos ? {
      icon: 'camera',
      text: `${day.roundVideos} ${pluralizeRounds(day.roundVideos)}`,
    } : undefined,
    day.media ? { icon: 'animations', text: `${day.media} медиа` } : undefined,
    day.gifts ? {
      icon: 'gift',
      text: day.gifts === 1 ? 'Отправлен подарок' : `${day.gifts} подарка`,
    } : undefined,
    day.premiumGifted ? {
      icon: 'diamond',
      text: 'Подарен Telegram Premium',
    } : undefined,
  ];

  return (
    <section className={styles.memory} aria-label={`Воспоминание за ${formatDate(day.date)}`}>
      <button type="button" className={styles.memoryClose} aria-label="Закрыть" onClick={onClose}>
        <Icon name="close" />
      </button>
      <span className={styles.memoryEyebrow}>ДЕНЬ В СОЗВЕЗДИИ</span>
      <strong className={styles.memoryDate}>{formatDate(day.date)}</strong>
      <div className={styles.memoryRows}>
        {rows.filter(Boolean).map(({ icon, text }) => (
          <span key={`${icon}-${text}`}>
            <Icon name={icon} />
            {text}
          </span>
        ))}
      </div>
      <button type="button" className={styles.openMessages} onClick={onOpenMessages}>
        Открыть сообщения этого дня
        <Icon name="arrow-right" />
      </button>
    </section>
  );
}

function formatPeople(
  first?: ReturnType<typeof selectUser>,
  second?: ReturnType<typeof selectUser>,
) {
  const firstName = first ? getUserFullName(first) : '';
  const secondName = second ? getUserFullName(second) : '';
  return [firstName, secondName].filter(Boolean).join(' · ');
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getPlural(value: number, one: string, few: string, many: string) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function pluralizeStars(value: number) {
  return getPlural(value, 'звезда', 'звезды', 'звёзд');
}

function pluralizeDays(value: number) {
  return getPlural(value, 'день', 'дня', 'дней');
}

function pluralizeMessages(value: number) {
  return getPlural(value, 'сообщение', 'сообщения', 'сообщений');
}

function pluralizeVoice(value: number) {
  return getPlural(value, 'голосовое', 'голосовых', 'голосовых');
}

function pluralizeRounds(value: number) {
  return getPlural(value, 'кружок', 'кружка', 'кружков');
}

export default memo(BygramConstellation);
