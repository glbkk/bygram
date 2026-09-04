import type { FC } from '../../lib/teact/teact';
import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { LeftColumnContent } from '../../types';

import buildClassName from '../../util/buildClassName';
import { getBygramSettings, subscribeBygramSettings } from '../../util/bygramArchive';

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
  const [settings, setSettings] = useState(() => getBygramSettings());

  useEffect(() => subscribeBygramSettings(setSettings), []);

  const showMusic = settings.isMusicButtonEnabled;
  const showFeed = settings.isFeedButtonEnabled;

  const openPanel = useLastCallback((contentKey: LeftColumnContent) => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }
    openLeftColumnContent({ contentKey });
  });

  if (!showMusic && !showFeed) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(
        'NewChatButton',
        'bygram-fabs',
        isShown && 'revealed',
        showMusic && showFeed && 'bygram-fabs-both',
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {showFeed && (
        <Button
          round
          color="primary"
          className="bygram-fab-button feed-fab-button"
          onClick={() => openPanel(LeftColumnContent.Feed)}
          ariaLabel="Лента"
          tabIndex={-1}
        >
          <svg
            className="bygram-fab-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h16v2H4v-2z"
            />
          </svg>
        </Button>
      )}
      {showMusic && (
        <Button
          round
          color="primary"
          className="bygram-fab-button music-fab-button"
          onClick={() => openPanel(LeftColumnContent.Music)}
          ariaLabel="Музыка"
          tabIndex={-1}
        >
          <svg
            className="bygram-fab-icon"
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
      )}
    </div>
  );
};

export default memo(NewChatButton);
