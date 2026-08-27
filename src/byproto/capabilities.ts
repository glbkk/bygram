import { BYPROTO_FEATURES, BYPROTO_VERSION } from './types';

export const LOCAL_BYPROTO_CAPABILITIES = {
  protocol: BYPROTO_VERSION,
  features: [...BYPROTO_FEATURES],
};
