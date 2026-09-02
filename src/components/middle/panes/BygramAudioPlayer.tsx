import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { LeftColumnContent } from '../../../types';

import { selectTabState } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { bygramMusicPlayer } from '../../../api/bygram/musicPlayer';

import useAppLayout from '../../../hooks/useAppLayout';
import useBygramMusicPlayer from '../../../hooks/useBygramMusicPlayer';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import RippleEffect from '../../ui/RippleEffect';

import '../panes/AudioPlayer.scss';

type OwnProps = {
  className?: string;
  noUi?: boolean;
  isCompact?: boolean;
  isHidden?: boolean;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  hasTelegramAudio?: boolean;
};

/**
 * Renders bygram playback with the same chrome as Telegram's built-in AudioPlayer,
 * so music keeps playing/controllable outside the music tab.
 */
const BygramAudioPlayer: FC<OwnProps & StateProps> = ({
  className,
  noUi,
  isCompact,
  isHidden,
  hasTelegramAudio,
  onPaneStateChange,
}) => {
  const { openLeftColumnContent } = getActions();
  const lang = useOldLang();
  const { isMobile } = useAppLayout();
  const player = useBygramMusicPlayer();

  const isOpen = Boolean(player.track) && !hasTelegramAudio && !isHidden;
  const isPane = !noUi;

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    isDisabled: !isPane,
    onStateChange: onPaneStateChange,
  });

  const handleToggle = useLastCallback(() => {
    bygramMusicPlayer.toggle();
  });

  const handleClose = useLastCallback(() => {
    bygramMusicPlayer.stop();
  });

  const handleOpenMusic = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Music });
  });

  if (noUi || !shouldRender || !player.track) {
    return undefined;
  }

  const title = player.track.title;
  const subtitle = player.track.artist;

  if (isCompact) {
    return (
      <div
        className={buildClassName(
          'AudioPlayer',
          'full-width-player',
          'compact-player',
          'BygramAudioPlayer',
          !isOpen && 'island-player-closing',
          className,
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
        ref={ref}
      >
        <Button
          round
          ripple={!isMobile}
          color="translucent"
          size="smaller"
          className={buildClassName('toggle-play', 'player-button', player.isPlaying ? 'pause' : 'play')}
          onClick={handleToggle}
          ariaLabel={player.isPlaying ? 'Пауза' : 'Играть'}
        >
          <Icon name="play" />
          <Icon name="pause" />
        </Button>
        <div className="AudioPlayer-content" onClick={handleOpenMusic}>
          {renderMeta(title, subtitle)}
          <RippleEffect />
        </div>
        <Button
          round
          className="player-close"
          color="translucent"
          size="smaller"
          onClick={handleClose}
          ariaLabel={lang('AudioPlayerClose')}
          iconName="close"
        />
      </div>
    );
  }

  return (
    <div
      className={buildClassName(
        'AudioPlayer',
        'full-width-player',
        'BygramAudioPlayer',
        !isOpen && 'island-player-closing',
        className,
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      ref={ref}
    >
      <div className="AudioPlayer-content" onClick={handleOpenMusic}>
        {renderMeta(title, subtitle)}
        <RippleEffect />
      </div>

      <Button
        round
        ripple={!IS_TOUCH_ENV}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={player.queueIndex <= 0 && player.position <= 4}
        onClick={() => void bygramMusicPlayer.previous()}
        ariaLabel="Previous track"
        iconName="skip-previous"
      />
      <Button
        round
        ripple={!IS_TOUCH_ENV}
        color="translucent"
        size="smaller"
        className={buildClassName('toggle-play', 'player-button', player.isPlaying ? 'pause' : 'play')}
        onClick={handleToggle}
        ariaLabel={player.isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <Icon name="play" />
        <Icon name="pause" />
      </Button>
      <Button
        round
        ripple={!IS_TOUCH_ENV}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={player.queueIndex >= player.queue.length - 1 && player.repeatMode !== 'queue'}
        onClick={() => void bygramMusicPlayer.next()}
        ariaLabel="Next track"
        iconName="skip-next"
      />
      <Button
        round
        className="player-close"
        color="translucent"
        size="smaller"
        onClick={handleClose}
        ariaLabel={lang('AudioPlayerClose')}
        iconName="close"
      />
    </div>
  );
};

function renderMeta(title: string, subtitle: string) {
  return (
    <>
      <div className="title" dir="auto">{title}</div>
      <div className="subtitle" dir="auto">{subtitle}</div>
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { isHidden }): Complete<StateProps> => {
    if (isHidden) return { hasTelegramAudio: true };
    const { chatId, messageId } = selectTabState(global).audioPlayer;
    return {
      hasTelegramAudio: Boolean(chatId && messageId),
    };
  },
)(BygramAudioPlayer));
