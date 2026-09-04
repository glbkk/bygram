import { memo, useEffect, useMemo, useRef, useSignal } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import { LeftColumnContent } from '../../types';

import buildClassName from '../../util/buildClassName';
import {
  collectBygramFeedMessages,
  collectUnreadChannelIds,
  getBygramFeedUnreadCount,
} from '../../util/bygramChannelFeed';

import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
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

const BygramChannelFeed = ({
  isReady,
  messages,
  unreadChannelIds,
  unreadCount,
}: OwnProps & StateProps) => {
  const { loadViewportMessages, focusMessage, openLeftColumnContent } = getActions();
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();
  const [getIsReady, setIsReady] = useSignal(Boolean(isReady));

  useEffect(() => {
    setIsReady(Boolean(isReady));
  }, [isReady, setIsReady]);

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

  useEffect(() => {
    unreadChannelIds.forEach((chatId) => {
      loadViewportMessages({ chatId, threadId: MAIN_THREAD_ID });
    });
  }, [unreadChannelIds, loadViewportMessages]);

  const handleClose = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.ChatList });
  });

  const handleOpenChannel = useLastCallback((chatId: string, messageId: number) => {
    focusMessage({ chatId, messageId });
  });

  const viewportMessages = useMemo(() => {
    if (!viewportIds?.length) return messages.slice(0, FEED_SLICE);
    const byKey = new Map(messages.map((message) => [`${message.chatId}:${message.id}`, message]));
    return viewportIds.map((key) => byKey.get(key)).filter(Boolean);
  }, [messages, viewportIds]);

  return (
    <main className={buildClassName('BygramChannelFeed', isReady && 'ready')}>
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
              ? lang('BygramFeedUnread', { count: unreadCount })
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
            <div
              key={`${message.chatId}-${message.id}`}
              className="BygramChannelFeed-item"
            >
              <button
                type="button"
                className="BygramChannelFeed-open-source"
                onClick={() => handleOpenChannel(message.chatId, message.id)}
              >
                {lang('BygramFeedOpenChannel')}
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
                isLastInList={index === viewportMessages.length - 1}
                isMessageListActive
                getIsMessageListReady={getIsReady}
                containerRef={containerRef}
                observeIntersectionForBottom={observeIntersectionForBottom}
                observeIntersectionForLoading={observeIntersectionForLoading}
                observeIntersectionForPlaying={observeIntersectionForPlaying}
              />
            </div>
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
