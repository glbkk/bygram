import type { FC } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { LeftColumnContent } from '../../types';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

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
        className="music-fab-button"
        onClick={handleClick}
        ariaLabel="Музыка"
        tabIndex={-1}
      >
        <svg
          className="music-fab-icon"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"
          />
        </svg>
      </Button>
    </div>
  );
};

export default NewChatButton;
