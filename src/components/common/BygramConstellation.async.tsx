import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

interface OwnProps {
  accountId: string;
  peerId: string;
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  onMessageOpen?: NoneToVoidFunction;
}

// The streak badge renders in every chat list row, so the constellation map and its canvas are only
// pulled in once a constellation is actually opened. Once loaded it stays mounted to keep close animations.
const BygramConstellationAsync: FC<OwnProps> = (props) => {
  const BygramConstellation = useModuleLoader(Bundles.Extra, 'BygramConstellation', !props.isOpen);

  return BygramConstellation ? <BygramConstellation {...props} /> : undefined;
};

export default memo(BygramConstellationAsync);
