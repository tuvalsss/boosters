import { PlaceholderPage } from '@/components/placeholder-page';
import { BagIcon } from '@/components/icons';

export const metadata = { title: 'Marketplace · Boosters' };

export default function MarketplacePage() {
  return (
    <PlaceholderPage
      title="Marketplace"
      phase="Phase 4 · Marketplace"
      description="Browse, filter and buy first-party and peer-to-peer listings in USDC. Every listing is backed 1:1 by a vaulted, graded card."
      icon={BagIcon}
    />
  );
}
