import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { StarGiftCategory } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import styles from './StarGiftCategoryList.module.scss';

export type GiftCatalogCategory = StarGiftCategory | 'archived';

type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  areUniqueStarGiftsDisallowed?: boolean;
  areLimitedStarGiftsDisallowed?: boolean;
  isSelf?: boolean;
  hasMyUnique?: boolean;
  hasArchived?: boolean;
  isPinned?: boolean;
  onCategoryChanged: (category: GiftCatalogCategory) => void;
};

type StateProps = {
  idsByCategory?: Record<StarGiftCategory, string[]>;
};

const StarGiftCategoryList = ({
  ref: externalRef,
  idsByCategory,
  onCategoryChanged,
  areUniqueStarGiftsDisallowed,
  areLimitedStarGiftsDisallowed,
  isSelf,
  hasMyUnique,
  hasArchived,
  isPinned,
}: StateProps & OwnProps) => {
  let ref = useRef<HTMLDivElement>();
  if (externalRef) {
    ref = externalRef;
  }

  const lang = useLang();

  const hasCollectible = Boolean(idsByCategory?.collectible?.length);

  const [selectedCategory, setSelectedCategory] = useState<GiftCatalogCategory>('all');

  function handleItemClick(category: GiftCatalogCategory) {
    setSelectedCategory(category);
    onCategoryChanged(category);
  }

  function renderCategoryName(category: GiftCatalogCategory) {
    if (category === 'all') return lang('AllGiftsCategory');
    if (category === 'myUnique') return lang('GiftCategoryMyGifts');
    if (category === 'collectible') return lang('GiftCategoryCollectibles');
    if (category === 'archived') return lang('BygramArchivedGiftTab');
    return category;
  }

  function renderCategoryItem(category: GiftCatalogCategory) {
    return (
      <div
        className={buildClassName(
          styles.item,
          selectedCategory === category && styles.selectedItem,
        )}
        onClick={() => handleItemClick(category)}
      >
        {renderCategoryName(category)}
      </div>
    );
  }

  useHorizontalScroll(ref, undefined, true);

  return (
    <div ref={ref} className={buildClassName(styles.list, isPinned && styles.pinned, 'no-scrollbar')}>
      {renderCategoryItem('all')}
      {hasArchived && renderCategoryItem('archived')}
      {!areUniqueStarGiftsDisallowed && !isSelf && hasMyUnique && renderCategoryItem('myUnique')}
      {(!areUniqueStarGiftsDisallowed || !areLimitedStarGiftsDisallowed)
        && hasCollectible && renderCategoryItem('collectible')}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { starGifts } = global;

    return {
      idsByCategory: starGifts?.idsByCategory,
    };
  },
)(StarGiftCategoryList));
