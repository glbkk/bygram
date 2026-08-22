import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import {
  closeBygramChatPasswordDialog,
  getBygramChatPasswordDialogRequest,
  subscribeBygramChatPasswordDialog,
} from '../../util/bygramChatPasswordDialog';
import {
  hasBygramChatPassword,
  removeBygramChatPassword,
  setBygramChatPassword,
  verifyBygramChatPassword,
} from '../../util/bygramChatSecurity';

import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './BygramChatPasswordModal.module.scss';

const MIN_CHAT_PASSWORD_LENGTH = 4;

const BygramChatPasswordModal = () => {
  const { showNotification } = getActions();
  const forceUpdate = useForceUpdate();
  const request = getBygramChatPasswordDialogRequest();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string>();
  const lang = useLang();

  useEffect(() => subscribeBygramChatPasswordDialog(forceUpdate), [forceUpdate]);
  useEffect(() => {
    setPassword('');
    setConfirmation('');
    setError(undefined);
  }, [request?.chatId, request?.mode]);

  const handleClose = useLastCallback(() => {
    closeBygramChatPasswordDialog(false);
  });

  const handlePasswordChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setError(undefined);
  });

  const handleConfirmationChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmation(e.target.value);
    setError(undefined);
  });

  const handleSubmit = useLastCallback(async () => {
    if (!request) return;

    if (request.mode === 'unlock') {
      const isValid = await verifyBygramChatPassword(request.chatId, password);
      if (!isValid) {
        setError(lang('BygramChatPasswordWrong'));
        return;
      }
      closeBygramChatPasswordDialog(true);
      return;
    }

    if (hasBygramChatPassword(request.chatId)) {
      const isRemoved = await removeBygramChatPassword(request.chatId, password);
      if (!isRemoved) {
        setError(lang('BygramChatPasswordWrong'));
        return;
      }
      showNotification({ message: lang('BygramChatPasswordRemoved') });
      closeBygramChatPasswordDialog();
      return;
    }

    if (password.length < MIN_CHAT_PASSWORD_LENGTH) {
      setError(lang('BygramChatPasswordShort'));
      return;
    }
    if (password !== confirmation) {
      setError(lang('BygramChatPasswordMismatch'));
      return;
    }

    await setBygramChatPassword(request.chatId, password);
    showNotification({ message: lang('BygramChatPasswordSaved') });
    closeBygramChatPasswordDialog();
  });

  const handleFormSubmit = useLastCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
  });

  const isProtected = request ? hasBygramChatPassword(request.chatId) : false;
  const isCreating = request?.mode === 'manage' && !isProtected;
  const title = request?.mode === 'unlock'
    ? lang('BygramChatPasswordUnlock')
    : isProtected ? lang('BygramChatPasswordRemove') : lang('BygramChatPasswordSet');

  return (
    <Modal
      className={`${styles.modal} mobile-bottom-sheet`}
      contentClassName={styles.modalContent}
      isOpen={Boolean(request)}
      title={title}
      hasCloseButton
      onClose={handleClose}
    >
      <p className={styles.description}>
        {lang(request?.mode === 'unlock' ? 'BygramChatPasswordUnlockDesc' : 'BygramChatPasswordDesc')}
      </p>
      <form className={styles.form} onSubmit={handleFormSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>{lang('BygramChatPassword')}</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={handlePasswordChange}
            autoFocus
          />
        </label>
        {isCreating && (
          <label className={styles.field}>
            <span className={styles.label}>{lang('BygramChatPasswordConfirm')}</span>
            <input
              className={styles.input}
              type="password"
              value={confirmation}
              autoComplete="new-password"
              onChange={handleConfirmationChange}
            />
          </label>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" fluid disabled={!password}>
          {lang(request?.mode === 'unlock' ? 'BygramChatPasswordOpen' : isProtected
            ? 'BygramChatPasswordRemove' : 'BygramChatPasswordSave')}
        </Button>
      </form>
    </Modal>
  );
};

export default memo(BygramChatPasswordModal);
