import type { FC } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { LeftColumnContent } from '../../types';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';

import './NewChatButton.scss';

type OwnProps = {
  isShown: boolean;
  isAccountFrozen?: boolean;
};

const NewChatButton: FC<OwnProps> = ({
  isShown,
  isAccountFrozen,
}) => {
  const { openFrozenAccountModal, openLeftColumnContent } = getActions();
  const lang = useOldLang();

  const handleClick = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }
    openLeftColumnContent({ contentKey: LeftColumnContent.Music });
  });

  return (
    <div
      className={buildClassName('NewChatButton', 'music-fab', isShown && 'revealed')}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <Button
        round
        color="primary"
        onClick={handleClick}
        ariaLabel="Музыка"
        tabIndex={-1}
      >
        <Icon name="note" />
      </Button>
    </div>
  );
};

export default NewChatButton;
