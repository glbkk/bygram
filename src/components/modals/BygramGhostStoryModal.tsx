import { memo, useEffect } from '../../lib/teact/teact';

import {
  getBygramGhostStoryRequest,
  resolveBygramGhostStoryChoice,
  subscribeBygramGhostStoryDialog,
} from '../../util/bygramGhostStoryDialog';

import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './BygramGhostStoryModal.module.scss';

const BygramGhostStoryModal = () => {
  const forceUpdate = useForceUpdate();
  const request = getBygramGhostStoryRequest();
  const lang = useLang();

  useEffect(() => subscribeBygramGhostStoryDialog(forceUpdate), [forceUpdate]);

  // Dismissing leaves the story unopened, which is the safe outcome when the point of the dialog is
  // to decide whether the author gets to see the view
  const handleClose = useLastCallback(() => {
    resolveBygramGhostStoryChoice(undefined);
  });

  const handleHidden = useLastCallback(() => {
    resolveBygramGhostStoryChoice('ghost');
  });

  const handleNormal = useLastCallback(() => {
    resolveBygramGhostStoryChoice('normal');
  });

  return (
    <Modal
      className={`${styles.modal} mobile-bottom-sheet`}
      contentClassName={styles.modalContent}
      isOpen={Boolean(request)}
      title={lang('BygramGhostStoryTitle')}
      hasCloseButton
      onClose={handleClose}
    >
      <p className={styles.description}>{lang('BygramGhostStoryDesc')}</p>
      <div className={styles.actions}>
        <Button fluid onClick={handleHidden}>{lang('BygramGhostStoryHidden')}</Button>
        <Button fluid isText onClick={handleNormal}>{lang('BygramGhostStoryNormal')}</Button>
      </div>
    </Modal>
  );
};

export default memo(BygramGhostStoryModal);
