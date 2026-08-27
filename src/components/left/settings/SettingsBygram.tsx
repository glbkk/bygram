import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type {
  BygramArchiveStats, BygramMessageBubbleStyle, BygramSettings,
} from '../../../util/bygramArchive';
import { ApiMediaFormat } from '../../../api/types';

import { getMediaThumbUri, getStickerMediaHash } from '../../../global/helpers';
import {
  BYGRAM_GIFT_BUBBLE_THEMES,
  clearBygramArchive,
  getBygramArchiveStats,
  getBygramSettings,
  updateBygramSettings,
} from '../../../util/bygramArchive';
import * as mediaLoader from '../../../util/mediaLoader';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedSticker from '../../common/AnimatedSticker';
import CustomEmoji from '../../common/CustomEmoji';
import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import StickerPicker from '../../middle/composer/StickerPicker';
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
  { id: 'plush-pepe', label: 'Plush Pepe', background: BYGRAM_GIFT_BUBBLE_THEMES['plush-pepe']!.background },
  { id: 'homemade-cake', label: 'Домашний торт', background: BYGRAM_GIFT_BUBBLE_THEMES['homemade-cake']!.background },
  { id: 'jelly-bunny', label: 'Jelly Bunny', background: BYGRAM_GIFT_BUBBLE_THEMES['jelly-bunny']!.background },
  { id: 'bow-tie', label: 'Bow Tie', background: BYGRAM_GIFT_BUBBLE_THEMES['bow-tie']!.background },
  { id: 'hanging-star', label: 'Hanging Star', background: BYGRAM_GIFT_BUBBLE_THEMES['hanging-star']!.background },
  { id: 'trapped-heart', label: 'Trapped Heart', background: BYGRAM_GIFT_BUBBLE_THEMES['trapped-heart']!.background },
  { id: 'rare-bird', label: 'Rare Bird', background: BYGRAM_GIFT_BUBBLE_THEMES['rare-bird']!.background },
  { id: 'sharp-tongue', label: 'Sharp Tongue', background: BYGRAM_GIFT_BUBBLE_THEMES['sharp-tongue']!.background },
  { id: 'nail-bracelet', label: 'Nail Bracelet', background: BYGRAM_GIFT_BUBBLE_THEMES['nail-bracelet']!.background },
  { id: 'ginger-cookie', label: 'Ginger Cookie', background: BYGRAM_GIFT_BUBBLE_THEMES['ginger-cookie']!.background },
  { id: 'fresh-socks', label: 'Fresh Socks', background: BYGRAM_GIFT_BUBBLE_THEMES['fresh-socks']!.background },
  {
    id: 'liberty-figure', label: 'Liberty Figure', background: BYGRAM_GIFT_BUBBLE_THEMES['liberty-figure']!.background,
  },
  { id: 'spiced-wine', label: 'Пряное вино', background: BYGRAM_GIFT_BUBBLE_THEMES['spiced-wine']!.background },
  { id: 'santa-hat', label: 'Шапка Санты', background: BYGRAM_GIFT_BUBBLE_THEMES['santa-hat']!.background },
  { id: 'ocean', label: 'Океан', background: 'linear-gradient(145deg, #1687FF, #0066E6)' },
  { id: 'violet', label: 'Фиолетовый', background: 'linear-gradient(145deg, #9B6DFF, #6C45E8)' },
  { id: 'sunset', label: 'Закат', background: 'linear-gradient(145deg, #FF7A59, #E94373)' },
  { id: 'mint', label: 'Мятный', background: 'linear-gradient(145deg, #20BFA9, #078B83)' },
  { id: 'custom', label: 'Конструктор', background: '' },
];

async function loadStickerPreview(sticker: ApiSticker) {
  const thumbnail = getMediaThumbUri(sticker);
  if (thumbnail) return thumbnail;

  const mediaUrl = await mediaLoader.fetch(getStickerMediaHash(sticker, 'preview'), ApiMediaFormat.BlobUrl);
  const response = await fetch(mediaUrl);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function SettingsBygram({ isActive, onReset }: OwnProps) {
  const { showNotification } = getActions();
  const [settings, setSettings] = useState<BygramSettings>(() => getBygramSettings());
  const [stats, setStats] = useState<BygramArchiveStats>(EMPTY_STATS);
  const [isStickerLoading, setIsStickerLoading] = useState(false);
  const [constructorPicker, setConstructorPicker] = useState<'sticker' | 'emoji'>('sticker');
  const [isClearDialogOpen, openClearDialog, closeClearDialog] = useFlag();
  const [isStickerPickerOpen, openStickerPicker, closeStickerPicker] = useFlag();
  const lang = useLang();
  const currentUserId = getGlobal().currentUserId;

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

  const handleBubbleEndColorChange = useLastCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(updateBygramSettings({
      messageBubbleStyle: 'custom',
      messageBubbleColorEnd: event.currentTarget.value.toUpperCase(),
    }));
  });

  const handleStickerSelect = useLastCallback(async (sticker: ApiSticker) => {
    setIsStickerLoading(true);
    try {
      const image = await loadStickerPreview(sticker);
      setSettings(updateBygramSettings({
        messageBubbleStyle: 'custom',
        messageBubbleStickerImage: image,
        messageBubbleSticker: sticker,
        messageBubbleCustomEmojiId: undefined,
      }));
      closeStickerPicker();
    } catch {
      showNotification({ message: 'Не удалось загрузить миниатюру стикера' });
    } finally {
      setIsStickerLoading(false);
    }
  });

  const handleCustomEmojiSelect = useLastCallback((sticker: ApiSticker) => {
    setSettings(updateBygramSettings({
      messageBubbleStyle: 'custom',
      messageBubbleStickerImage: undefined,
      messageBubbleSticker: undefined,
      messageBubbleCustomEmojiId: sticker.id,
    }));
    closeStickerPicker();
  });

  const handleRemoveSticker = useLastCallback(() => {
    setSettings(updateBygramSettings({
      messageBubbleStickerImage: undefined,
      messageBubbleSticker: undefined,
      messageBubbleCustomEmojiId: undefined,
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

      <IslandTitle>Связь ByGram</IslandTitle>
      <Island>
        <Checkbox
          label="ByProto"
          subLabel="Передавать оформление и ByGram emoji внутри обычных сообщений Telegram"
          checked={settings.isByProtoEnabled}
          onCheck={(value) => handleSettingChange('isByProtoEnabled', value)}
        />
        <Checkbox
          label="Принимать оформление"
          subLabel="Автоматически сохранять пузыри и баннеры пользователей ByGram"
          checked={settings.isByProtoAutoAcceptProfiles}
          disabled={!settings.isByProtoEnabled}
          onCheck={(value) => handleSettingChange('isByProtoAutoAcceptProfiles', value)}
        />
      </Island>
      <IslandDescription>
        Данные передаются напрямую через Telegram и хранятся только на этом устройстве.
      </IslandDescription>

      <IslandTitle>Самолётик</IslandTitle>
      <Island>
        <Checkbox
          label="Серия общения"
          subLabel="Показывать самолётик и число дней, когда вы общаетесь каждый день"
          checked={settings.isChatStreakEnabled}
          onCheck={(value) => handleSettingChange('isChatStreakEnabled', value)}
        />
      </Island>
      <IslandDescription>
        Серия считается локально по сообщениям, которые bygram успел получить. У собеседника в bygram она
        рассчитывается по тем же сообщениям независимо.
      </IslandDescription>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('BygramBubbleTitle')}</IslandTitle>
      <Island>
        <div className={styles.bubbleGrid} role="radiogroup" aria-label={lang('BygramBubbleTitle')}>
          {BUBBLE_STYLES.map(({ id, label, background }) => {
            const isSelected = settings.messageBubbleStyle === id;
            const previewBackground = id === 'custom' && settings.isMessageBubbleGradientEnabled
              ? `linear-gradient(145deg, ${settings.messageBubbleColor}, ${settings.messageBubbleColorEnd})`
              : id === 'custom' ? settings.messageBubbleColor : background;
            const giftImage = BYGRAM_GIFT_BUBBLE_THEMES[id]?.image
              || (id === 'custom' ? settings.messageBubbleStickerImage : undefined);
            const giftAnimation = BYGRAM_GIFT_BUBBLE_THEMES[id]?.animation;
            const telegramTitle = BYGRAM_GIFT_BUBBLE_THEMES[id]?.telegramTitle;
            const telegramGiftSticker = telegramTitle && Object.values(getGlobal().starGifts?.byId || {})
              .find(({ title }) => title?.localeCompare(telegramTitle, undefined, { sensitivity: 'base' }) === 0)
              ?.sticker;
            const customEmojiId = id === 'custom' ? settings.messageBubbleCustomEmojiId : undefined;
            const customSticker = id === 'custom' ? settings.messageBubbleSticker : undefined;
            const shouldAnimatePreview = isSelected && settings.isMessageBubbleGiftAnimated;
            return (
              <button
                type="button"
                className={`${styles.bubbleOption} ${isSelected ? styles.bubbleOptionActive : ''}`}
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleBubbleStyleChange(id)}
              >
                <span className={styles.bubblePreview} style={`background: ${previewBackground}`}>
                  {telegramGiftSticker ? (
                    <CustomEmoji
                      className={styles.bubbleGift}
                      sticker={telegramGiftSticker}
                      size={29}
                      isBig
                      noPlay={!shouldAnimatePreview}
                      shouldNotLoop={!shouldAnimatePreview}
                      shouldPreloadPreview
                    />
                  ) : giftAnimation && shouldAnimatePreview ? (
                    <AnimatedSticker
                      className={styles.bubbleGift}
                      tgsUrl={giftAnimation}
                      size={29}
                      play
                      isLowPriority
                    />
                  ) : customEmojiId ? (
                    <CustomEmoji
                      className={styles.bubbleGift}
                      documentId={customEmojiId}
                      size={29}
                      isBig
                      noPlay={!shouldAnimatePreview}
                      shouldNotLoop={!shouldAnimatePreview}
                      shouldPreloadPreview
                    />
                  ) : customSticker ? (
                    <CustomEmoji
                      className={styles.bubbleGift}
                      sticker={customSticker}
                      size={29}
                      isBig
                      noPlay={!shouldAnimatePreview}
                      shouldNotLoop={!shouldAnimatePreview}
                      shouldPreloadPreview
                    />
                  ) : giftImage && (
                    <img
                      src={giftImage}
                      alt=""
                      className={styles.bubbleGift}
                    />
                  )}
                  <span className={styles.previewLine} />
                  <span className={styles.previewLineShort} />
                </span>
                <span className={styles.bubbleName}>{label}</span>
              </button>
            );
          })}
        </div>
        {settings.messageBubbleStyle === 'custom' && (
          <div className={styles.constructor}>
            <div className={styles.colorControls}>
              <label className={styles.colorControl}>
                <span>Начало фона</span>
                <input
                  className={styles.colorInput}
                  type="color"
                  value={settings.messageBubbleColor}
                  aria-label="Начальный цвет пузыря"
                  onChange={handleBubbleColorChange}
                />
              </label>
              <label className={styles.colorControl}>
                <span>Конец фона</span>
                <input
                  className={styles.colorInput}
                  type="color"
                  value={settings.messageBubbleColorEnd}
                  aria-label="Конечный цвет пузыря"
                  disabled={!settings.isMessageBubbleGradientEnabled}
                  onChange={handleBubbleEndColorChange}
                />
              </label>
            </div>
            <Checkbox
              label="Градиентный фон"
              checked={settings.isMessageBubbleGradientEnabled}
              onCheck={(value) => setSettings(updateBygramSettings({ isMessageBubbleGradientEnabled: value }))}
            />
            <div className={styles.stickerActions}>
              <button
                type="button"
                className={styles.constructorButton}
                onClick={isStickerPickerOpen ? closeStickerPicker : openStickerPicker}
              >
                {isStickerPickerOpen
                  ? 'Закрыть наборы'
                  : (settings.messageBubbleStickerImage || settings.messageBubbleCustomEmojiId)
                    ? 'Заменить декор' : 'Выбрать декор'}
              </button>
              {(settings.messageBubbleStickerImage || settings.messageBubbleCustomEmojiId) && (
                <button type="button" className={styles.removeButton} onClick={handleRemoveSticker}>Убрать</button>
              )}
            </div>
            {isStickerPickerOpen && currentUserId && (
              <div className={styles.stickerPickerShell}>
                <div className={styles.pickerTabs} role="tablist" aria-label="Тип декора">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={constructorPicker === 'sticker'}
                    className={constructorPicker === 'sticker' ? styles.pickerTabActive : undefined}
                    onClick={() => setConstructorPicker('sticker')}
                  >
                    Стикеры
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={constructorPicker === 'emoji'}
                    className={constructorPicker === 'emoji' ? styles.pickerTabActive : undefined}
                    onClick={() => setConstructorPicker('emoji')}
                  >
                    Premium emoji
                  </button>
                </div>
                <div className={styles.pickerContent}>
                  {constructorPicker === 'sticker' ? (
                    <StickerPicker
                      className=""
                      chatId={currentUserId}
                      idPrefix="bygram-bubble"
                      isForSelection
                      loadAndPlay
                      canSendStickers={false}
                      noContextMenus
                      onStickerSelect={handleStickerSelect}
                    />
                  ) : (
                    <CustomEmojiPicker
                      chatId={currentUserId}
                      idPrefix="bygram-bubble-emoji"
                      loadAndPlay
                      noAddButton
                      forceAvailable
                      onCustomEmojiSelect={handleCustomEmojiSelect}
                    />
                  )}
                </div>
                {isStickerLoading && <div className={styles.pickerLoading}>Сохраняю стикер…</div>}
              </div>
            )}
          </div>
        )}
        {settings.messageBubbleStyle !== 'default' && (
          <Checkbox
            label="Анимация подарка"
            subLabel="Лёгкое движение без дополнительной нагрузки на чат"
            checked={settings.isMessageBubbleGiftAnimated}
            onCheck={(value) => setSettings(updateBygramSettings({ isMessageBubbleGiftAnimated: value }))}
          />
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
