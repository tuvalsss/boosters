import type { Branch } from './branches';

export interface PackAssetSet {
  front: string;
  back: string;
  opened: string;
}

export const PACK_ASSET_PRESETS = [
  '/assets/brand-packs/creature-front.svg',
  '/assets/brand-packs/adventure-front.svg',
  '/assets/brand-packs/arcana-front.svg',
  '/assets/brand-packs/sports-front.svg',
  '/assets/brand-packs/rookie-front.svg',
  '/assets/brand-packs/legend-front.svg',
] as const;

const FRONT_TO_SET: Record<string, PackAssetSet> = Object.fromEntries(
  PACK_ASSET_PRESETS.map((front) => {
    const base = front.replace('-front.svg', '');
    return [front, { front, back: `${base}-back.svg`, opened: `${base}-opened.svg` }];
  }),
) as Record<string, PackAssetSet>;

export function packAssetsFor(front: string | null | undefined, fallback: Branch): PackAssetSet {
  if (front && FRONT_TO_SET[front]) return FRONT_TO_SET[front];
  if (front?.endsWith('-front.svg')) {
    const base = front.replace('-front.svg', '');
    return { front, back: `${base}-back.svg`, opened: `${base}-opened.svg` };
  }
  return {
    front: front || fallback.packImage,
    back: fallback.packBackImage,
    opened: fallback.packOpenedImage,
  };
}
