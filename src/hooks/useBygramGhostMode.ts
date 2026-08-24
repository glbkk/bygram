import { useEffect, useState } from '../lib/teact/teact';

import { getBygramSettings, subscribeBygramSettings } from '../util/bygramArchive';

export default function useBygramGhostMode() {
  const [isEnabled, setIsEnabled] = useState(() => getBygramSettings().isGhostModeEnabled);

  useEffect(() => subscribeBygramSettings((settings) => {
    setIsEnabled(settings.isGhostModeEnabled);
  }), []);

  return isEnabled;
}
