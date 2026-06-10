'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GiftIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';

type ReferralSummary = {
  code: string;
  referredBy: { id: string; displayName: string | null; email: string | null } | null;
  stats: {
    joined: number;
    pendingUsdc: string;
    availableUsdc: string;
    paidUsdc: string;
    totalUsdc: string;
  };
  referrals: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    createdAt: string;
  }>;
  rewards: Array<{
    id: string;
    eventType: string;
    status: string;
    amountUsdc: string;
    createdAt: string;
    referredUser: { id: string; displayName: string | null; email: string | null };
  }>;
};

const NEXT_ACTIONS = [
  { label: 'Open packs', href: '/packs' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'KYC status', href: '/account' },
];

export default function ReferPage() {
  const { ready, authenticated, login, apiFetch } = useAuth();
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setSummary(null);
      setError(null);
      return;
    }

    let active = true;
    apiFetch<ReferralSummary>('/me/referrals')
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setError(null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [authenticated, apiFetch]);

  const referralCode = authenticated ? (summary?.code ?? 'LOADING') : 'SIGN-IN';
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
            Invite collectors and track rewards across onboarding and confirmed deposits. Bonuses
            settle through the same account ledger used by the rest of Boosters.
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40">Referral code</p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                {authenticated ? 'Account linked' : 'Sign in to activate'}
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
                  disabled={!summary}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/40"
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
            {summary?.referredBy && (
              <p className="mt-3 text-xs text-white/45">
                Joined through{' '}
                {summary.referredBy.displayName ?? summary.referredBy.email ?? 'a collector'}.
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                {error}
              </p>
            )}
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
          <div className="mt-4 grid gap-3">
            <Metric label="Collectors joined" value={summary?.stats.joined.toString() ?? '0'} />
            <Metric label="Available bonus" value={usd(summary?.stats.availableUsdc ?? '0')} />
            <Metric label="Pending bonus" value={usd(summary?.stats.pendingUsdc ?? '0')} />
            <Metric label="Lifetime bonus" value={usd(summary?.stats.totalUsdc ?? '0')} />
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Latest rewards</p>
            <div className="mt-3 space-y-2">
              {summary?.rewards.length ? (
                summary.rewards.slice(0, 4).map((reward) => (
                  <div key={reward.id} className="rounded-xl bg-white/[0.04] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{usd(reward.amountUsdc)}</p>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/50">
                        {reward.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {reward.referredUser.displayName ?? reward.referredUser.email ?? 'Collector'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-white/[0.04] px-3 py-3 text-xs leading-5 text-white/45">
                  Rewards appear here after referred users complete confirmed deposits.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
