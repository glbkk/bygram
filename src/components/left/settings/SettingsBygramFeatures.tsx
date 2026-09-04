import { memo } from '../../../lib/teact/teact';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';

import styles from './SettingsBygramFeatures.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: NoneToVoidFunction;
};

const FEATURES = [
  {
    title: 'Лента каналов',
    text: 'Непрочитанные посты из всех подписок в одной ленте: реакции и комментарии прямо на месте.',
  },
  {
    title: 'Музыка bygramMusic',
    text: 'Встроенный плеер и каталог без отдельного аккаунта.',
  },
  {
    title: 'Расшифровка голосовых',
    text: 'Кнопка расшифровки для всех: Premium через Telegram, иначе локальный Whisper в браузере.',
  },
  {
    title: 'Пересылка любых сообщений',
    text: 'Даже с запретом пересылки bygram отправит копию без пометки «переслано».',
  },
  {
    title: 'Время в сети',
    text: 'Точное локальное last-seen, когда Telegram пишет только «был недавно».',
  },
  {
    title: 'Режим призрака',
    text: 'Просмотр историй без отметки о просмотре.',
  },
  {
    title: 'Локальный архив',
    text: 'Антиудаление и история правок сообщений на этом устройстве.',
  },
  {
    title: 'Без рекламы',
    text: 'Встроенные спонсорские сообщения Telegram скрыты.',
  },
  {
    title: 'ByProto',
    text: 'Пузыри, баннеры и bygram emoji передаются внутри обычных сообщений.',
  },
  {
    title: 'Серия общения',
    text: 'Самолётик и счётчик дней подряд, когда вы переписываетесь каждый день.',
  },
  {
    title: 'Оформление чатов',
    text: 'Темы пузырей, подарки и кастомные обои чата.',
  },
  {
    title: 'Нативный UX',
    text: 'Быстрые переходы, свайп-назад, хаптики и поведение ближе к Telegram iOS.',
  },
] as const;

function SettingsBygramFeatures({ isActive, onReset }: OwnProps) {
  const lang = useLang();
  useHistoryBack({ isActive, onBack: onReset });

  return (
    <div className="settings-content custom-scroll">
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramFeaturesTitle')}</IslandTitle>
      <Island>
        {FEATURES.map((feature) => (
          <div key={feature.title} className={styles.item}>
            <div className={styles.title}>{feature.title}</div>
            <div className={styles.text}>{feature.text}</div>
          </div>
        ))}
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('BygramFeaturesFooter')}
      </IslandDescription>
    </div>
  );
}

export default memo(SettingsBygramFeatures);
