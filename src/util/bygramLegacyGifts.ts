export const BYGRAM_LEGACY_GIFT_PRICE = 50;

export const BYGRAM_LEGACY_GIFTS = [
  { id: '5922558454332916696', titleKey: 'BygramLegacyGiftTree' },
  { id: '5801108895304779062', titleKey: 'BygramLegacyGiftHeart' },
  { id: '5956217000635139069', titleKey: 'BygramLegacyGiftNewYearBear' },
  { id: '5800655655995968830', titleKey: 'BygramLegacyGiftValentineBear' },
  { id: '5866352046986232958', titleKey: 'BygramLegacyGiftMarchBear' },
  { id: '5935895822435615975', titleKey: 'BygramLegacyGiftClownBear' },
  { id: '5969796561943660080', titleKey: 'BygramLegacyGiftEasterBear' },
  { id: '6026193266406327981', titleKey: 'BygramLegacyGiftMayBear' },
  { id: '5974210632977745012', titleKey: 'BygramLegacyGiftFootballBear' },
  { id: '6046178578163303744', titleKey: 'BygramLegacyGiftTacticalBear' },
] as const;

export function getBygramLegacyGiftImageUrl(giftId: string) {
  return `https://cdn.changes.tg/gifts/originals/${giftId}/Original.png`;
}
