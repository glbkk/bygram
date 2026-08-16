import type { ChangeEvent } from 'react';
import { memo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { BygramLegacyGift } from '../../../util/bygramLegacyGifts';

import { getPeerTitle, isApiPeerUser } from '../../../global/helpers/peers';
import { selectPeer, selectPeerPaidMessagesStars, selectTabState } from '../../../global/selectors';
import {
  BYGRAM_LEGACY_GIFT_PRICE,
  getBygramLegacyGiftImageUrl,
} from '../../../util/bygramLegacyGifts';
import { formatStarsAsIcon } from '../../../util/localization/format';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';
import TextArea from '../../ui/TextArea';

import styles from './ArchivedGiftComposer.module.scss';

type OwnProps = {
  gift: BygramLegacyGift;
  peerId: string;
};

type StateProps = {
  peer?: ApiPeer;
  currentUserId?: string;
  captionLimit?: number;
  paidMessagesStars?: number;
  isPaymentFormLoading?: boolean;
};

const LIMIT_DISPLAY_THRESHOLD = 50;

function ArchivedGiftComposer({
  gift,
  peerId,
  peer,
  currentUserId,
  captionLimit,
  paidMessagesStars,
  isPaymentFormLoading,
}: OwnProps & StateProps) {
  const { sendStarGiftById } = getActions();
  const lang = useLang();
  const [giftMessage, setGiftMessage] = useState('');
  const [shouldHideName, setShouldHideName] = useState(false);

  const handleGiftMessageChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setGiftMessage(e.target.value);
  });

  const handleShouldHideNameChange = useLastCallback(() => {
    setShouldHideName(!shouldHideName);
  });

  const handleSend = useLastCallback(() => {
    sendStarGiftById({
      giftId: gift.id,
      peerId,
      message: giftMessage ? { text: giftMessage } : undefined,
      shouldHideName: shouldHideName || undefined,
    });
  });

  const symbolsLeft = captionLimit ? captionLimit - giftMessage.length : undefined;
  const peerTitle = peer ? getPeerTitle(lang, peer) : '';
  const isSelf = currentUserId === peerId;
  const isPeerUser = peer && isApiPeerUser(peer);

  return (
    <div className={styles.root}>
      <div className={styles.preview}>
        <img
          className={styles.image}
          src={getBygramLegacyGiftImageUrl(gift.id)}
          alt={lang(gift.titleKey)}
        />
        <h3 className={styles.title}>{lang(gift.titleKey)}</h3>
        <div className={styles.price}>
          {formatStarsAsIcon(lang, BYGRAM_LEGACY_GIFT_PRICE, { asFont: true })}
        </div>
      </div>

      <div className={styles.options}>
        {!paidMessagesStars && (
          <TextArea
            className={styles.messageInput}
            onChange={handleGiftMessageChange}
            value={giftMessage}
            label={lang('GiftMessagePlaceholder')}
            maxLength={captionLimit}
            maxLengthIndicator={symbolsLeft && symbolsLeft < LIMIT_DISPLAY_THRESHOLD
              ? symbolsLeft.toString() : undefined}
          />
        )}

        <ListItem className={styles.switcher} narrow ripple onClick={handleShouldHideNameChange}>
          <span>{lang('GiftHideMyName')}</span>
          <Switcher checked={shouldHideName} inactive label={lang('GiftHideMyName')} />
        </ListItem>
        <div className={styles.description}>
          {isSelf ? lang('GiftHideNameDescriptionSelf')
            : isPeerUser ? lang('GiftHideNameDescription', { receiver: peerTitle })
              : lang('GiftHideNameDescriptionChannel')}
        </div>
      </div>

      <div className={styles.spacer} />
      <div className={styles.footer}>
        <Button
          size="smaller"
          onClick={handleSend}
          isLoading={isPaymentFormLoading}
          inline
          noForcedUpperCase
        >
          {lang('GiftSend', {
            amount: formatStarsAsIcon(lang, BYGRAM_LEGACY_GIFT_PRICE, { asFont: true }),
          }, { withNodes: true })}
        </Button>
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { peerId }): Complete<StateProps> => {
  return {
    peer: selectPeer(global, peerId),
    currentUserId: global.currentUserId,
    captionLimit: global.appConfig.starGiftMaxMessageLength,
    paidMessagesStars: selectPeerPaidMessagesStars(global, peerId),
    isPaymentFormLoading: selectTabState(global).isPaymentFormLoading,
  };
})(ArchivedGiftComposer));
