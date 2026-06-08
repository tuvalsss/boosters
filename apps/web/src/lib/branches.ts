// Branch catalog: production-safe Boosters-owned visual defaults.
// Admins can replace pack art per pack with licensed third-party assets.

export type BranchKey = 'creature' | 'adventure' | 'arcana' | 'sports' | 'rookie' | 'legend';

export interface Branch {
  key: BranchKey;
  name: string;
  accent: string;
  tagline: string;
  packImage: string;
  packBackImage: string;
  packOpenedImage: string;
  cardImages: [string, string];
  priceUsdc: number;
}

export const BRANCHES: Branch[] = [
  {
    key: 'creature',
    name: 'Creature TCG',
    accent: '#2563eb',
    tagline: 'Original fantasy-card pulls with vaulted 1:1 custody.',
    packImage: '/assets/brand-packs/creature-front.svg',
    packBackImage: '/assets/brand-packs/creature-back.svg',
    packOpenedImage: '/assets/brand-packs/creature-opened.svg',
    cardImages: ['/assets/brand-cards/creature-card.svg', '/assets/brand-cards/gold-card.svg'],
    priceUsdc: 59,
  },
  {
    key: 'adventure',
    name: 'Adventure TCG',
    accent: '#5b8b24',
    tagline: 'Sea-and-story themed cards, authenticated and vaulted.',
    packImage: '/assets/brand-packs/adventure-front.svg',
    packBackImage: '/assets/brand-packs/adventure-back.svg',
    packOpenedImage: '/assets/brand-packs/adventure-opened.svg',
    cardImages: ['/assets/brand-cards/adventure-card.svg', '/assets/brand-cards/vault-card.svg'],
    priceUsdc: 39,
  },
  {
    key: 'arcana',
    name: 'Arcana Duel',
    accent: '#7c3aed',
    tagline: 'Duel-inspired original cards with transparent odds.',
    packImage: '/assets/brand-packs/arcana-front.svg',
    packBackImage: '/assets/brand-packs/arcana-back.svg',
    packOpenedImage: '/assets/brand-packs/arcana-opened.svg',
    cardImages: ['/assets/brand-cards/arcana-card.svg', '/assets/brand-cards/gold-card.svg'],
    priceUsdc: 49,
  },
  {
    key: 'sports',
    name: 'Sports Icons',
    accent: '#d7263d',
    tagline: 'Rookie-inspired sports cards and vault-backed ownership.',
    packImage: '/assets/brand-packs/sports-front.svg',
    packBackImage: '/assets/brand-packs/sports-back.svg',
    packOpenedImage: '/assets/brand-packs/sports-opened.svg',
    cardImages: ['/assets/brand-cards/sports-card.svg', '/assets/brand-cards/vault-card.svg'],
    priceUsdc: 45,
  },
  {
    key: 'rookie',
    name: 'Rookie Core',
    accent: '#00a8b5',
    tagline: 'Entry-tier Boosters packs for everyday collectors.',
    packImage: '/assets/brand-packs/rookie-front.svg',
    packBackImage: '/assets/brand-packs/rookie-back.svg',
    packOpenedImage: '/assets/brand-packs/rookie-opened.svg',
    cardImages: ['/assets/brand-cards/creature-card.svg', '/assets/brand-cards/sports-card.svg'],
    priceUsdc: 35,
  },
  {
    key: 'legend',
    name: 'Vault Legends',
    accent: '#f59e0b',
    tagline: 'Premium chase-tier cards from the Boosters vault.',
    packImage: '/assets/brand-packs/legend-front.svg',
    packBackImage: '/assets/brand-packs/legend-back.svg',
    packOpenedImage: '/assets/brand-packs/legend-opened.svg',
    cardImages: ['/assets/brand-cards/gold-card.svg', '/assets/brand-cards/vault-card.svg'],
    priceUsdc: 89,
  },
];

export function branchByKey(key: BranchKey): Branch {
  const branch = BRANCHES.find((b) => b.key === key);
  if (!branch) throw new Error(`Unknown branch: ${key}`);
  return branch;
}
