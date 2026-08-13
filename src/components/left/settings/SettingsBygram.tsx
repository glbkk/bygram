import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { BygramArchiveStats, BygramSettings } from '../../../util/bygramArchive';

import {
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
