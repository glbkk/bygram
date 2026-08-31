import { describe, expect, it } from 'vitest';
import { Api as GramJs } from '../../../lib/gramjs';

import { buildStickerFromDocument } from './symbols';

const STICKER_SET = new GramJs.InputStickerSetID({ id: BigInt(1), accessHash: BigInt(2) });

function buildDocument(attributes: GramJs.TypeDocumentAttribute[]) {
  return new GramJs.Document({
    id: BigInt(10),
    accessHash: BigInt(11),
    fileReference: Buffer.alloc(0),
    date: 0,
    mimeType: 'image/webp',
    size: BigInt(1024),
    dcId: 2,
    attributes,
  });
}

describe('buildStickerFromDocument', () => {
  // `free` is `flags.0?true`, so an emoji that requires Premium arrives with the field absent rather
  // than set to `false`. Reading it as "free unless told otherwise" marked every paid emoji as free
  // and silently disabled the bygram fallback that keeps them working without Premium.
  it('marks a custom emoji without the free flag as paid', () => {
    const sticker = buildStickerFromDocument(buildDocument([
      new GramJs.DocumentAttributeCustomEmoji({ alt: '😎', stickerset: STICKER_SET }),
    ]));

    expect(sticker?.isCustomEmoji).toBe(true);
    expect(sticker?.isFree).toBe(false);
  });

  it('marks a custom emoji carrying the free flag as free', () => {
    const sticker = buildStickerFromDocument(buildDocument([
      new GramJs.DocumentAttributeCustomEmoji({ alt: '😎', stickerset: STICKER_SET, free: true }),
    ]));

    expect(sticker?.isFree).toBe(true);
  });

  it('keeps plain stickers free, since only custom emoji carry the flag', () => {
    const sticker = buildStickerFromDocument(buildDocument([
      new GramJs.DocumentAttributeSticker({ alt: '😎', stickerset: STICKER_SET }),
    ]));

    expect(sticker?.isCustomEmoji).toBe(false);
    expect(sticker?.isFree).toBe(true);
  });
});
