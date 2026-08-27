import { useEffect, useState } from '@teact';

import type { ByProtoPeerSnapshot } from '../byproto/types';

import {
  ensureByProtoPeerLoaded,
  getByProtoPeerSnapshot,
  subscribeByProtoPeer,
} from '../byproto/runtime';

export default function useByProtoPeer(peerId?: string) {
  const [snapshot, setSnapshot] = useState<ByProtoPeerSnapshot | undefined>(() => (
    peerId ? getByProtoPeerSnapshot(peerId) : undefined
  ));

  useEffect(() => {
    if (!peerId) {
      setSnapshot(undefined);
      return undefined;
    }
    setSnapshot(getByProtoPeerSnapshot(peerId));
    void ensureByProtoPeerLoaded(peerId).then(setSnapshot);
    return subscribeByProtoPeer(peerId, setSnapshot);
  }, [peerId]);

  return snapshot;
}
