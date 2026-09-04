import type { ElementRef } from '../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef, useSignal } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';
import { LeftColumnContent } from '../../types';

import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import {
  collectBygramFeedMessages,
  collectUnreadChannelIds,
  getBygramFeedUnreadCount,
} from '../../util/bygramChannelFeed';
import { captureControlledSwipe } from '../../util/swipeController';

import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import { useIntersectionObserver, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import InfiniteScroll from '../ui/InfiniteScroll';
import Loading from '../ui/Loading';
import Message from './message/Message';

import './BygramChannelFeed.scss';

type OwnProps = {
  isReady?: boolean;
};

type StateProps = {
  messages: ApiMessage[];
  unreadChannelIds: string[];
  unreadCount: number;
};

const INTERSECTION_THROTTLE = 200;
const FEED_SLICE = 24;

type FeedItemProps = {
  message: ApiMessage;
  isLast: boolean;
  getIsReady: Signal<boolean>;
  containerRef: ElementRef<HTMLDivElement>;
  observeIntersectionForBottom: ObserveFn;
  observeIntersectionForLoading: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
  observeIntersectionForReading: ObserveFn;
  onOpenChannel: (chatId: string, messageId: number) => void;
  openChannelLabel: string;
};

const FeedItem = memo(({
  message,
  isLast,
  getIsReady,
  containerRef,
  observeIntersectionForBottom,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  observeIntersectionForReading,
  onOpenChannel,
  openChannelLabel,
}: FeedItemProps) => {
  const { markBygramFeedMessageRead } = getActions();
  const itemRef = useRef<HTMLDivElement>();

  useOnIntersect(itemRef, observeIntersectionForReading, (entry) => {
    if (!entry.isIntersecting) return;
    markBygramFeedMessageRead({
      chatId: message.chatId,
      messageId: message.id,
    });
  });

  return (
    <div ref={itemRef} className="BygramChannelFeed-item">
      <button
        type="button"
        className="BygramChannelFeed-open-source"
        onClick={() => onOpenChannel(message.chatId, message.id)}
      >
        {openChannelLabel}
      </button>
      <Message
        message={message}
        threadId={MAIN_THREAD_ID}
        messageListType="thread"
        withAvatar
        withSenderName
        noComments={false}
        noReplies={false}
        appearanceOrder={0}
        isJustAdded={false}
        isFirstInGroup
        isLastInGroup
        isFirstInDocumentGroup
        isLastInDocumentGroup
        isLastInList={isLast}
        isMessageListActive
        getIsMessageListReady={getIsReady}
        containerRef={containerRef}
        observeIntersectionForBottom={observeIntersectionForBottom}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
      />
    </div>
  );
});

const BygramChannelFeed = ({
  isReady,
  messages,
  unreadChannelIds,
  unreadCount,
}: OwnProps & StateProps) => {
  const {
    loadBygramChannelFeed,
    focusMessage,
    openLeftColumnContent,
  } = getActions();
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();
  const rootRef = useRef<HTMLDivElement>();
  const [getIsReady, setIsReady] = useSignal(Boolean(isReady));

  useEffect(() => {
    setIsReady(Boolean(isReady));
  }, [isReady, setIsReady]);

  useEffect(() => {
    loadBygramChannelFeed();
  }, [loadBygramChannelFeed]);

  const handleClose = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.ChatList });
  });

  useEffect(() => {
    if (!IS_TOUCH_ENV || !rootRef.current) {
      return undefined;
    }

    return captureControlledSwipe(rootRef.current, {
      excludedClosestSelector: '.Modal, .Menu, .media-viewer',
      selectorToPreventScroll: '.BygramChannelFeed-scroll',
      onSwipeRightStart: handleClose,
      onCancel: () => {
        openLeftColumnContent({ contentKey: LeftColumnContent.Feed });
      },
    });
  }, [handleClose, openLeftColumnContent]);

  const messageIds = useMemo(
    () => messages.map((message) => `${message.chatId}:${message.id}`),
    [messages],
  );
  const [viewportIds, getMore] = useInfiniteScroll(undefined, messageIds, undefined, FEED_SLICE);

  const { observe: observeIntersectionForBottom } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });
  const { observe: observeIntersectionForLoading } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });
  const { observe: observeIntersectionForPlaying } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });
  const { observe: observeIntersectionForReading } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
    threshold: 0.45,
  });

  const handleOpenChannel = useLastCallback((chatId: string, messageId: number) => {
    focusMessage({ chatId, messageId });
  });

  const viewportMessages = useMemo(() => {
    if (!viewportIds?.length) return messages.slice(0, FEED_SLICE);
    const byKey = new Map(messages.map((message) => [`${message.chatId}:${message.id}`, message]));
    return viewportIds.map((key) => byKey.get(key)).filter(Boolean) as ApiMessage[];
  }, [messages, viewportIds]);

  const openChannelLabel = lang('BygramFeedOpenChannel');

  return (
    <main
      ref={rootRef}
      className={buildClassName('BygramChannelFeed', isReady && 'ready')}
    >
      <header className="BygramChannelFeed-header">
        <Button
          round
          color="translucent"
          iconName="arrow-left"
          ariaLabel={lang('BygramFeedBack')}
          onClick={handleClose}
        />
        <div className="BygramChannelFeed-heading">
          <strong>{lang('BygramFeedTitle')}</strong>
          <span>
            {unreadCount > 0
              ? `${unreadCount} непрочитанных постов`
              : lang('BygramFeedEmptyHint')}
          </span>
        </div>
      </header>

      {!viewportMessages.length ? (
        <div className="BygramChannelFeed-empty">
          {unreadChannelIds.length ? (
            <Loading />
          ) : (
            <>
              <Icon name="channel" />
              <p>{lang('BygramFeedEmpty')}</p>
            </>
          )}
        </div>
      ) : (
        <InfiniteScroll
          ref={containerRef}
          className="BygramChannelFeed-scroll MessageList custom-scroll"
          items={viewportIds || messageIds}
          onLoadMore={getMore}
          preloadBackwards={FEED_SLICE}
        >
          {viewportMessages.map((message, index) => (
            <FeedItem
              key={`${message.chatId}-${message.id}`}
              message={message}
              isLast={index === viewportMessages.length - 1}
              getIsReady={getIsReady}
              containerRef={containerRef}
              observeIntersectionForBottom={observeIntersectionForBottom}
              observeIntersectionForLoading={observeIntersectionForLoading}
              observeIntersectionForPlaying={observeIntersectionForPlaying}
              observeIntersectionForReading={observeIntersectionForReading}
              onOpenChannel={handleOpenChannel}
              openChannelLabel={openChannelLabel}
            />
          ))}
        </InfiniteScroll>
      )}
    </main>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      messages: collectBygramFeedMessages(global),
      unreadChannelIds: collectUnreadChannelIds(global),
      unreadCount: getBygramFeedUnreadCount(global),
    };
  },
)(BygramChannelFeed));
