import Link from 'next/link';
import { ClockIcon } from '@/components/icons';

export const metadata = { title: 'Activity · Boosters' };

const ACTIVITY = [
  {
    type: 'Pack pull',
    title: 'PSA 10 Charizard VMAX moved to vault reserve',
    detail: 'Pokemon / sealed pack pool',
    time: '2m',
    accent: 'bg-emerald-400',
  },
  {
    type: 'Marketplace',
    title: 'First-party listing settled with double-entry USDC ledger',
    detail: 'Seller paid, treasury fee recorded',
    time: '14m',
    accent: 'bg-sky-400',
  },
  {
    type: 'Raffle',
    title: 'Courtside rookie raffle reached 80% sold',
    detail: 'Provably-fair draw pending sellout',
    time: '31m',
    accent: 'bg-amber-300',
  },
  {
    type: 'Redeem',
    title: 'Physical redemption moved to shipped',
    detail: 'Tracking attached by ops',
    time: '1h',
    accent: 'bg-fuchsia-400',
  },
  {
    type: 'Submission',
    title: 'User consignment entered grading review',
    detail: 'Ops timeline updated',
    time: '2h',
    accent: 'bg-violet-400',
  },
];

const METRICS = [
  ['Vault events', '128'],
  ['Ledgered orders', '76'],
  ['Open raffles', '9'],
  ['Redemptions', '18'],
];

export default function ActivityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75">
            <ClockIcon />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            A product-wide operations feed for vaulted cards, pack openings, marketplace movement,
            raffles, and redemptions.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Browse Marketplace
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {ACTIVITY.map((item, index) => (
          <div
            key={`${item.type}-${item.time}`}
            className={[
              'grid gap-4 px-4 py-4 sm:grid-cols-[8rem_1fr_4rem] sm:items-center',
              index === 0 ? '' : 'border-t border-white/10',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${item.accent}`} />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/45">
                {item.type}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-white/45">{item.detail}</p>
            </div>
            <p className="text-xs text-white/35 sm:text-right">{item.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
