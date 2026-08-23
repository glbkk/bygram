import { memo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiVideo } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { getVideoMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import {
  getBygramProfileBannerKey,
  removeBygramCustomizationMedia,
  saveBygramCustomizationMedia,
} from '../../../util/bygramCustomization';
import * as mediaLoader from '../../../util/mediaLoader';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useBygramCustomizationMedia from '../../../hooks/useBygramCustomizationMedia';
import useLastCallback from '../../../hooks/useLastCallback';

import GifPicker from '../../middle/composer/GifPicker';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './BygramProfileBannerEditor.module.scss';

type StateProps = {
  currentUserId?: string;
};

const MAX_BANNER_SIZE = 50 * 1024 * 1024;

const BygramProfileBannerEditor = ({ currentUserId }: StateProps) => {
  const { showNotification } = getActions();
  const bannerKey = currentUserId ? getBygramProfileBannerKey(currentUserId) : undefined;
  const banner = useBygramCustomizationMedia(bannerKey);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveBlob = useLastCallback(async (blob: Blob, source: 'gallery' | 'telegram-gif') => {
    if (!bannerKey) return;
    if (blob.size > MAX_BANNER_SIZE) {
      showNotification({ message: 'Баннер должен быть меньше 50 МБ' });
      return;
    }

    setIsSaving(true);
    try {
      await saveBygramCustomizationMedia(bannerKey, blob, source);
      showNotification({ message: 'Баннер профиля сохранён' });
      return true;
    } catch {
      showNotification({ message: 'Не удалось сохранить баннер' });
      return false;
    } finally {
      setIsSaving(false);
    }
  });

  const handleGalleryClick = useLastCallback(() => {
    openSystemFilesDialog('image/*', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) void saveBlob(file, 'gallery');
    }, true);
  });

  const handleGifSelect = useLastCallback(async (gif: ApiVideo) => {
    setIsSaving(true);
    try {
      const mediaHash = getVideoMediaHash(gif, 'full');
      if (!gif.blobUrl && !mediaHash) throw new Error('GIF_MEDIA_MISSING');
      const mediaUrl = gif.blobUrl || await mediaLoader.fetch(mediaHash!, ApiMediaFormat.BlobUrl);
      const blob = await fetch(mediaUrl).then((response) => response.blob());
      const isSaved = await saveBlob(blob, 'telegram-gif');
      if (isSaved) setIsGifPickerOpen(false);
    } catch {
      showNotification({ message: 'Не удалось загрузить GIF из Telegram' });
      setIsSaving(false);
    }
  });

  const handleRemove = useLastCallback(async () => {
    if (!bannerKey) return;
    try {
      await removeBygramCustomizationMedia(bannerKey);
      showNotification({ message: 'Баннер профиля удалён' });
    } catch {
      showNotification({ message: 'Не удалось удалить баннер' });
    }
  });

  return (
    <>
      <div className={styles.root}>
        <div className={styles.preview}>
          {banner?.isVideo ? (
            <video src={banner.url} autoPlay loop muted playsInline disablePictureInPicture />
          ) : banner ? (
            <img src={banner.url} alt="" draggable={false} />
          ) : (
            <div className={styles.placeholder}>
              <span className="icon icon-photo" />
              <span>Баннер профиля</span>
            </div>
          )}
          <div className={styles.previewShade} />
        </div>
        <div className={styles.actions}>
          <Button size="tiny" color="primary" onClick={handleGalleryClick} disabled={isSaving}>
            Из галереи
          </Button>
          <Button size="tiny" color="translucent" onClick={() => setIsGifPickerOpen(true)} disabled={isSaving}>
            GIF из Telegram
          </Button>
          {banner && (
            <Button size="tiny" color="danger" onClick={handleRemove} disabled={isSaving}>
              Удалить
            </Button>
          )}
        </div>
        <p className={styles.hint}>Хранится только на этом устройстве и отображается в bygram.</p>
      </div>

      <Modal
        isOpen={isGifPickerOpen}
        title="Выберите GIF"
        hasCloseButton
        className={buildClassName(styles.gifModal, 'mobile-full-screen')}
        dialogClassName={styles.gifDialog}
        contentClassName={styles.gifModalContent}
        onClose={() => setIsGifPickerOpen(false)}
      >
        <GifPicker
          className={styles.gifPicker}
          loadAndPlay={isGifPickerOpen}
          canSendGifs
          onGifSelect={handleGifSelect}
        />
      </Modal>
    </>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({ currentUserId: global.currentUserId }),
)(BygramProfileBannerEditor));
