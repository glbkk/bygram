import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  BygramArchiveStats, BygramMessageBubbleStyle, BygramSettings,
} from '../../../util/bygramArchive';

import {
  BYGRAM_GIFT_BUBBLE_THEMES,
  clearBygramArchive,
  getBygramArchiveStats,
  getBygramSettings,
  updateBygramSettings,
} from '../../../util/bygramArchive';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import RangeSlider from '../../ui/RangeSlider';

import styles from './SettingsBygram.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: NoneToVoidFunction;
};

const MEDIA_LIMITS_MB = [64, 128, 256, 512, 1024];
const EMPTY_STATS: BygramArchiveStats = {
  messageCount: 0,
  deletedCount: 0,
  mediaBytes: 0,
};
const BUBBLE_STYLES: Array<{
  id: BygramMessageBubbleStyle;
  label: string;
  background: string;
}> = [
  { id: 'default', label: 'Обычный', background: 'var(--color-background-own)' },
  { id: 'homemade-cake', label: 'Домашний торт', background: BYGRAM_GIFT_BUBBLE_THEMES['homemade-cake']!.background },
  { id: 'jelly-bunny', label: 'Желейный кролик', background: BYGRAM_GIFT_BUBBLE_THEMES['jelly-bunny']!.background },
  { id: 'spiced-wine', label: 'Пряное вино', background: BYGRAM_GIFT_BUBBLE_THEMES['spiced-wine']!.background },
  { id: 'santa-hat', label: 'Шапка Санты', background: BYGRAM_GIFT_BUBBLE_THEMES['santa-hat']!.background },
  { id: 'ocean', label: 'Океан', background: 'linear-gradient(145deg, #1687FF, #0066E6)' },
  { id: 'violet', label: 'Фиолетовый', background: 'linear-gradient(145deg, #9B6DFF, #6C45E8)' },
  { id: 'sunset', label: 'Закат', background: 'linear-gradient(145deg, #FF7A59, #E94373)' },
  { id: 'mint', label: 'Мятный', background: 'linear-gradient(145deg, #20BFA9, #078B83)' },
  { id: 'custom', label: 'Свой цвет', background: '' },
];

function SettingsBygram({ isActive, onReset }: OwnProps) {
  const { showNotification } = getActions();
  const [settings, setSettings] = useState<BygramSettings>(() => getBygramSettings());
  const [stats, setStats] = useState<BygramArchiveStats>(EMPTY_STATS);
  const [isClearDialogOpen, openClearDialog, closeClearDialog] = useFlag();
  const lang = useLang();

  useHistoryBack({ isActive, onBack: onReset });

  useEffect(() => {
    void refreshStats();
  }, []);

  const refreshStats = useLastCallback(async () => {
    setStats(await getBygramArchiveStats());
  });

  const handleSettingChange = useLastCallback((key: keyof BygramSettings, value: boolean | number) => {
    setSettings(updateBygramSettings({ [key]: value }));
  });

  const handleMediaLimitChange = useLastCallback((index: number) => {
    handleSettingChange('mediaArchiveLimitMb', MEDIA_LIMITS_MB[index]);
  });

  const handleBubbleStyleChange = useLastCallback((style: BygramMessageBubbleStyle) => {
    setSettings(updateBygramSettings({ messageBubbleStyle: style }));
  });

  const handleBubbleColorChange = useLastCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(updateBygramSettings({
      messageBubbleStyle: 'custom',
      messageBubbleColor: event.currentTarget.value.toUpperCase(),
    }));
  });

  const renderMediaLimit = useLastCallback((index: number) => {
    const size = MEDIA_LIMITS_MB[index];
    return lang('MediaSizeMB', { size }, { pluralValue: size });
  });

  const handleClear = useLastCallback(async () => {
    await clearBygramArchive();
    closeClearDialog();
    await refreshStats();
    showNotification({ message: { key: 'BygramArchiveCleared' } });
  });

  const mediaLimitIndex = Math.max(0, MEDIA_LIMITS_MB.indexOf(settings.mediaArchiveLimitMb));
  const mediaSizeMb = Math.round(stats.mediaBytes / (1024 * 1024));

  return (
    <div className="settings-content custom-scroll">
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramArchiveTitle')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('BygramLocalArchive')}
          subLabel={lang('BygramLocalArchiveDesc')}
          checked={settings.isArchiveEnabled}
          onCheck={(value) => handleSettingChange('isArchiveEnabled', value)}
        />
        <Checkbox
          label={lang('BygramAntiDelete')}
          subLabel={lang('BygramAntiDeleteDesc')}
          checked={settings.isAntiDeleteEnabled}
          disabled={!settings.isArchiveEnabled}
          onCheck={(value) => handleSettingChange('isAntiDeleteEnabled', value)}
        />
        <Checkbox
          label={lang('BygramEditHistory')}
          subLabel={lang('BygramEditHistoryDesc')}
          checked={settings.isEditHistoryEnabled}
          disabled={!settings.isArchiveEnabled}
          onCheck={(value) => handleSettingChange('isEditHistoryEnabled', value)}
        />
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('BygramIosNotice')}
      </IslandDescription>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramPrivacyTitle')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('BygramGhostMode')}
          subLabel={lang('BygramGhostModeDesc')}
          checked={settings.isGhostModeEnabled}
          onCheck={(value) => handleSettingChange('isGhostModeEnabled', value)}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramBubbleTitle')}</IslandTitle>
      <Island>
        <div className={styles.bubbleGrid} role="radiogroup" aria-label={lang('BygramBubbleTitle')}>
          {BUBBLE_STYLES.map(({ id, label, background }) => {
            const isSelected = settings.messageBubbleStyle === id;
            const previewBackground = id === 'custom' ? settings.messageBubbleColor : background;
            const giftImage = BYGRAM_GIFT_BUBBLE_THEMES[id]?.image;
            return (
              <button
                type="button"
                className={`${styles.bubbleOption} ${isSelected ? styles.bubbleOptionActive : ''}`}
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleBubbleStyleChange(id)}
              >
                <span className={styles.bubblePreview} style={`background: ${previewBackground}`}>
                  {giftImage && <img src={giftImage} alt="" className={styles.bubbleGift} />}
                  <span className={styles.previewLine} />
                  <span className={styles.previewLineShort} />
                </span>
                <span className={styles.bubbleName}>{label}</span>
              </button>
            );
          })}
        </div>
        {settings.messageBubbleStyle === 'custom' && (
          <label className={styles.customColorRow}>
            <input
              className={styles.colorInput}
              type="color"
              value={settings.messageBubbleColor}
              aria-label={lang('BygramBubbleCustomColor')}
              onChange={handleBubbleColorChange}
            />
            <span className={styles.colorLabel}>
              <span>{lang('BygramBubbleCustomColor')}</span>
              <span className={styles.colorValue}>{settings.messageBubbleColor}</span>
            </span>
          </label>
        )}
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('BygramBubbleDesc')}
      </IslandDescription>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramMediaTitle')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('BygramMediaArchive')}
          subLabel={lang('BygramMediaArchiveDesc')}
          checked={settings.isMediaArchiveEnabled}
          disabled={!settings.isArchiveEnabled}
          onCheck={(value) => handleSettingChange('isMediaArchiveEnabled', value)}
        />
        <RangeSlider
          label={lang('BygramMediaLimit')}
          min={0}
          max={MEDIA_LIMITS_MB.length - 1}
          value={mediaLimitIndex}
          disabled={!settings.isMediaArchiveEnabled}
          renderValue={renderMediaLimit}
          onChange={handleMediaLimitChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramStorageTitle')}</IslandTitle>
      <Island>
        <ListItem icon="folder-filled" multiline disabled>
          <span className="title">{lang('BygramStoredMessages', { count: stats.messageCount })}</span>
          <span className="subtitle">
            {lang('BygramStorageStats', { deleted: stats.deletedCount, media: mediaSizeMb })}
          </span>
        </ListItem>
        <ListItem icon="delete" multiline onClick={openClearDialog}>
          <span className="title">{lang('BygramClearArchive')}</span>
          <span className="subtitle">{lang('BygramClearArchiveDesc')}</span>
        </ListItem>
      </Island>

      <ConfirmDialog
        isOpen={isClearDialogOpen}
        title={lang('BygramClearArchive')}
        text={lang('BygramClearConfirm')}
        confirmLabel={lang('Delete')}
        confirmIsDestructive
        confirmHandler={handleClear}
        onClose={closeClearDialog}
      />
    </div>
  );
}

export default memo(SettingsBygram);
