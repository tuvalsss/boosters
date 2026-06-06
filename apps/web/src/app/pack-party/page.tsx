import { PlaceholderPage } from '@/components/placeholder-page';
import { PartyIcon } from '@/components/icons';

export const metadata = { title: 'Pack Party · Boosters' };

export default function PackPartyPage() {
  return (
    <PlaceholderPage
      title="Pack Party"
      phase="Coming soon"
      description="Open packs live with others. Provably-fair draws, shared in real time."
      icon={PartyIcon}
    />
  );
}
