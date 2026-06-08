import Link from 'next/link';
import { GiftIcon } from '@/components/icons';

export const metadata = { title: 'Refer & Earn · Boosters' };

const REWARDS = [
  ['Friend joins', 'Priority vault onboarding'],
  ['First pack opened', '$5 sandbox credit'],
  ['First marketplace trade', '2% fee rebate pool'],
];

export default function ReferPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black">
            <GiftIcon />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Refer & Earn</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            Bring collectors into devnet and track rewards across onboarding, pack activity, and
            marketplace volume.
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Referral code</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-12 flex-1 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 font-mono text-sm tracking-widest text-white">
                BOOSTERS-VAULT
              </div>
              <Link
                href="/account"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Open Account
              </Link>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold tracking-tight">Reward track</h2>
          <div className="mt-4 space-y-3">
            {REWARDS.map(([label, value], index) => (
              <div key={label} className="flex gap-3 rounded-xl bg-white/[0.04] p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-white/45">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
