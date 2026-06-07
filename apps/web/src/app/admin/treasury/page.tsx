'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';
import { isStaff } from '@/lib/types';

interface TreasuryStatus {
  balanceUsdc: string;
  floorUsdc: string;
  availableForBuybackUsdc: string;
  paused: boolean;
}

export default function TreasuryPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [status, setStatus] = useState<TreasuryStatus | null>(null);
  const [amount, setAmount] = useState('');
  const [fmvItem, setFmvItem] = useState('');
  const [fmvValue, setFmvValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setStatus(await apiFetch<TreasuryStatus>('/admin/buyback/treasury'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Treasury &amp; buyback</h1>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Treasury balance" value={usd(status?.balanceUsdc ?? '0')} />
        <Stat label="Float floor" value={usd(status?.floorUsdc ?? '0')} />
        <Stat
          label="Available for buyback"
          value={usd(status?.availableForBuybackUsdc ?? '0')}
          accent
        />
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="font-semibold">Buyback {status?.paused ? 'paused' : 'active'}</p>
          <p className="text-xs text-white/45">Pausing stops new quotes and payouts.</p>
        </div>
        <button
          onClick={() =>
            run(() =>
              apiFetch(`/admin/buyback/pause?paused=${!status?.paused}`, { method: 'POST' }),
            )
          }
          className={`h-10 rounded-xl px-4 text-sm font-semibold ${status?.paused ? 'bg-emerald-400 text-black' : 'border border-white/15'}`}
        >
          {status?.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-sm font-semibold">Fund treasury float (devnet)</p>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="USDC"
            className="h-10 w-32 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
          <button
            onClick={() =>
              run(async () => {
                await apiFetch('/admin/buyback/treasury/credit', {
                  method: 'POST',
                  body: JSON.stringify({ amountUsdc: amount }),
                });
                setAmount('');
              })
            }
            disabled={!amount}
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
          >
            Credit
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-sm font-semibold">Set FMV for a vault item</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={fmvItem}
            onChange={(e) => setFmvItem(e.target.value)}
            placeholder="Vault item id"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
          <input
            value={fmvValue}
            onChange={(e) => setFmvValue(e.target.value)}
            placeholder="FMV USDC"
            className="h-10 w-32 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
          <button
            onClick={() =>
              run(async () => {
                await apiFetch('/admin/buyback/fmv', {
                  method: 'POST',
                  body: JSON.stringify({ vaultItemId: fmvItem, valueUsdc: fmvValue }),
                });
                setFmvItem('');
                setFmvValue('');
              })
            }
            disabled={!fmvItem || !fmvValue}
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
          >
            Set FMV
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-widest text-white/45">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? 'text-emerald-300' : ''}`}>{value}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
