// Branch catalog: production-safe Boosters-owned visual defaults.
// Admins can replace pack art per pack with licensed third-party assets.

export type BranchKey = 'creature' | 'adventure' | 'arcana' | 'sports' | 'rookie' | 'legend';

export interface Branch {
  key: BranchKey;
  name: string;
  accent: string;
  tagline: string;
  packImage: string;
  cardImages: [string, string];
  priceUsdc: number;
}

export const BRANCHES: Branch[] = [
  {
    key: 'creature',
    name: 'Creature TCG',
    accent: '#2563eb',
    tagline: 'Original fantasy-card pulls with vaulted 1:1 custody.',
    packImage: '/assets/brand-packs/creature.svg',
    cardImages: ['/assets/brand-cards/creature-card.svg', '/assets/brand-cards/gold-card.svg'],
    priceUsdc: 59,
  },
  {
    key: 'adventure',
    name: 'Adventure TCG',
    accent: '#0891b2',
    tagline: 'Sea-and-story themed cards, authenticated and vaulted.',
    packImage: '/assets/brand-packs/silver.svg',
    cardImages: ['/assets/brand-cards/adventure-card.svg', '/assets/brand-cards/vault-card.svg'],
    priceUsdc: 39,
  },
  {
    key: 'arcana',
    name: 'Arcana Duel',
    accent: '#7c3aed',
    tagline: 'Duel-inspired original cards with transparent odds.',
    packImage: '/assets/brand-packs/legend.svg',
    cardImages: ['/assets/brand-cards/arcana-card.svg', '/assets/brand-cards/gold-card.svg'],
    priceUsdc: 49,
  },
  {
    key: 'sports',
    name: 'Sports Icons',
    accent: '#d7263d',
    tagline: 'Rookie-inspired sports cards and vault-backed ownership.',
    packImage: '/assets/brand-packs/sports.svg',
    cardImages: ['/assets/brand-cards/sports-card.svg', '/assets/brand-cards/vault-card.svg'],
    priceUsdc: 45,
  },
  {
    key: 'rookie',
    name: 'Rookie Core',
    accent: '#1fbf75',
    tagline: 'Entry-tier Boosters packs for everyday collectors.',
    packImage: '/assets/brand-packs/rookie.svg',
    cardImages: ['/assets/brand-cards/creature-card.svg', '/assets/brand-cards/sports-card.svg'],
    priceUsdc: 35,
  },
  {
    key: 'legend',
    name: 'Vault Legends',
    accent: '#f59e0b',
    tagline: 'Premium chase-tier cards from the Boosters vault.',
    packImage: '/assets/brand-packs/gold.svg',
    cardImages: ['/assets/brand-cards/gold-card.svg', '/assets/brand-cards/vault-card.svg'],
    priceUsdc: 89,
  },
];

export function branchByKey(key: BranchKey): Branch {
  const branch = BRANCHES.find((b) => b.key === key);
  if (!branch) throw new Error(`Unknown branch: ${key}`);
  return branch;
}
