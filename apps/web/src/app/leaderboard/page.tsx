import Link from 'next/link';
import { TrophyIcon } from '@/components/icons';

export const metadata = { title: 'Leaderboard · Boosters' };

const COLLECTORS = [
  { rank: 1, name: 'VaultRunner', score: '18,420', specialty: 'Pokemon grails', pulls: 42 },
  { rank: 2, name: 'SlabSide', score: '15,870', specialty: 'NBA rookies', pulls: 37 },
  { rank: 3, name: 'MintedAce', score: '12,940', specialty: 'One Piece TCG', pulls: 31 },
  { rank: 4, name: 'Gridiron10', score: '10,610', specialty: 'NFL slabs', pulls: 26 },
  { rank: 5, name: 'CardFloat', score: '9,880', specialty: 'TCG mix', pulls: 22 },
];

const HIGHLIGHTS = [
  ['Highest pull', '$4,800 FMV'],
  ['Fastest sellout', '11m raffle'],
  ['Most redemptions', '8 claimed'],
];

export default function LeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300 text-black">
              <TrophyIcon />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
              <p className="text-sm text-white/50">Collectors ranked by pack pulls and trades.</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
            {COLLECTORS.map((collector) => (
              <div
                key={collector.rank}
                className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-white/10 px-3 py-4 last:border-b-0 sm:grid-cols-[4rem_1fr_7rem_5rem]"
              >
                <span className="text-lg font-black text-white/45">#{collector.rank}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{collector.name}</p>
                  <p className="truncate text-xs text-white/40">{collector.specialty}</p>
                </div>
                <p className="hidden text-right text-sm font-semibold text-emerald-300 sm:block">
                  {collector.score}
                </p>
                <p className="text-right text-xs text-white/45">{collector.pulls} pulls</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-3">
          {HIGHLIGHTS.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
              <p className="mt-2 text-xl font-bold">{value}</p>
            </div>
          ))}
          <Link
            href="/packs"
            className="flex h-12 items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Open Packs
          </Link>
        </aside>
      </div>
    </div>
  );
}
