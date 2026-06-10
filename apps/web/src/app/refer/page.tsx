'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GiftIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';

const REWARDS = [
  ['Friend joins', 'Priority vault onboarding'],
  ['First pack opened', '$5 sandbox credit'],
  ['First marketplace trade', '2% fee rebate pool'],
];

const NEXT_ACTIONS = [
  { label: 'Open packs', href: '/packs' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'KYC status', href: '/account' },
];

export default function ReferPage() {
  const { ready, authenticated, dbUser, login } = useAuth();
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const referralCode = useMemo(() => {
    const raw = dbUser?.displayName || dbUser?.email || dbUser?.id || 'BOOSTERS-VAULT';
    return raw
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 10)
      .toUpperCase()
      .padEnd(6, 'X');
  }, [dbUser]);
  const referralLink = `${origin || 'http://localhost:3100'}?ref=${encodeURIComponent(referralCode)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black">
            <GiftIcon />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Refer & Earn</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            Invite collectors and track rewards across onboarding, pack activity, and marketplace
            volume. Rewards settle through the same account ledger used by the rest of Boosters.
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40">Referral code</p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                {authenticated ? 'Account linked' : 'Guest preview'}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-12 flex-1 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 font-mono text-sm tracking-widest text-white">
                {ready ? referralCode : 'LOADING'}
              </div>
              {authenticated ? (
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={login}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Sign in
                </button>
              )}
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 font-mono text-xs text-white/55">
              {referralLink}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {NEXT_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                {action.label}
              </Link>
            ))}
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
          <p className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/10 px-3 py-3 text-xs leading-5 text-emerald-50/70">
            Referral rewards should be finalized by backend events once a real provider is
            connected. The page is wired to the live account state and ready for that endpoint.
          </p>
        </aside>
      </div>
    </div>
  );
}
