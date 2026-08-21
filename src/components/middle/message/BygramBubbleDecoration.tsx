import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import {
  BYGRAM_GIFT_BUBBLE_THEMES,
  getBygramSettings,
  subscribeBygramSettings,
} from '../../../util/bygramArchive';

import AnimatedSticker from '../../common/AnimatedSticker';
import CustomEmoji from '../../common/CustomEmoji';

type OwnProps = {
  isVisible: boolean;
};

type StateProps = {
  telegramGifts?: Array<{ title?: string; sticker: ApiSticker }>;
};

const DECORATION_SIZE = 46;

function BygramBubbleDecoration({ isVisible, telegramGifts }: OwnProps & StateProps) {
  const [settings, setSettings] = useState(getBygramSettings);

  useEffect(() => subscribeBygramSettings(setSettings), []);

  if (!isVisible || settings.messageBubbleStyle === 'default') return undefined;

  const giftTheme = BYGRAM_GIFT_BUBBLE_THEMES[settings.messageBubbleStyle];
  const shouldPlay = settings.isMessageBubbleGiftAnimated;
  const telegramGiftSticker = giftTheme?.telegramTitle && telegramGifts?.find(({ title }) => (
    title?.localeCompare(giftTheme.telegramTitle!, undefined, { sensitivity: 'base' }) === 0
  ))?.sticker;

  if (telegramGiftSticker) {
    return (
      <div className="bygram-bubble-decoration" aria-hidden>
        <CustomEmoji
          sticker={telegramGiftSticker}
          size={DECORATION_SIZE}
          isBig
          noPlay={!shouldPlay}
          shouldNotLoop={!shouldPlay}
          shouldPreloadPreview
        />
      </div>
    );
  }

  if (giftTheme?.animation && shouldPlay) {
    return (
      <div className="bygram-bubble-decoration" aria-hidden>
        <AnimatedSticker
          tgsUrl={giftTheme.animation}
          size={DECORATION_SIZE}
          play
          isLowPriority
        />
      </div>
    );
  }

  if (giftTheme?.image) {
    return (
      <div className="bygram-bubble-decoration" aria-hidden>
        <img src={giftTheme.image} alt="" draggable={false} />
      </div>
    );
  }

  if (settings.messageBubbleStyle !== 'custom') return undefined;

  if (settings.messageBubbleCustomEmojiId) {
    return (
      <div className="bygram-bubble-decoration" aria-hidden>
        <CustomEmoji
          documentId={settings.messageBubbleCustomEmojiId}
          size={DECORATION_SIZE}
          isBig
          noPlay={!shouldPlay}
          shouldNotLoop={!shouldPlay}
          shouldPreloadPreview
        />
      </div>
    );
  }

  if (settings.messageBubbleSticker) {
    return (
      <div className="bygram-bubble-decoration" aria-hidden>
        <CustomEmoji
          sticker={settings.messageBubbleSticker}
          size={DECORATION_SIZE}
          isBig
          noPlay={!shouldPlay}
          shouldNotLoop={!shouldPlay}
          shouldPreloadPreview
        />
      </div>
    );
  }

  if (!settings.messageBubbleStickerImage) return undefined;

  return (
    <div className="bygram-bubble-decoration" aria-hidden>
      <img src={settings.messageBubbleStickerImage} alt="" draggable={false} />
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  telegramGifts: global.starGifts ? Object.values(global.starGifts.byId) : undefined,
}))(BygramBubbleDecoration));
