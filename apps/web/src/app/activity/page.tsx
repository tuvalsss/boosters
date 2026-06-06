import { PlaceholderPage } from '@/components/placeholder-page';
import { ClockIcon } from '@/components/icons';

export const metadata = { title: 'Activity · Boosters' };

export default function ActivityPage() {
  return (
    <PlaceholderPage
      title="Activity"
      phase="Coming soon"
      description="A live feed of pulls, sales, redemptions and raffle draws."
      icon={ClockIcon}
    />
  );
}
