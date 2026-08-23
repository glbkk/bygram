import { useEffect, useState } from '../lib/teact/teact';

import type { BygramCustomizationMedia } from '../util/bygramCustomization';

import {
  getBygramCustomizationMedia,
  subscribeBygramCustomization,
} from '../util/bygramCustomization';

export type ResolvedBygramCustomizationMedia = BygramCustomizationMedia & {
  url: string;
  isVideo: boolean;
};

export default function useBygramCustomizationMedia(key?: string) {
  const [revision, setRevision] = useState(0);
  const [media, setMedia] = useState<ResolvedBygramCustomizationMedia | undefined>();

  useEffect(() => subscribeBygramCustomization(key, () => setRevision((value) => value + 1)), [key]);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | undefined;

    setMedia(undefined);
    if (!key) return undefined;

    getBygramCustomizationMedia(key).then((storedMedia) => {
      if (isCancelled || !storedMedia?.blob) return;

      objectUrl = URL.createObjectURL(storedMedia.blob);
      setMedia({
        ...storedMedia,
        url: objectUrl,
        isVideo: storedMedia.mimeType.startsWith('video/'),
      });
    }).catch(() => undefined);

    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, revision]);

  return media;
}
