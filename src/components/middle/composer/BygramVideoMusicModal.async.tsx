import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { OwnProps } from './BygramVideoMusicModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BygramVideoMusicModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const BygramVideoMusicModal = useModuleLoader(Bundles.Extra, 'BygramVideoMusicModal', !isOpen);

  return BygramVideoMusicModal ? <BygramVideoMusicModal {...props} /> : undefined;
};

export default memo(BygramVideoMusicModalAsync);
