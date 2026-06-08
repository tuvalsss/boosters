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

interface WithdrawalRow {
  id: string;
  status: string;
  amountUsdc: string;
  metadata: { destination?: string; destinationType?: string };
  createdAt: string;
  buyer: { email: string | null; walletAddress: string | null; kycStatus: string } | null;
}

export default function TreasuryPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [status, setStatus] = useState<TreasuryStatus | null>(null);
  const [amount, setAmount] = useState('');
  const [fmvItem, setFmvItem] = useState('');
  const [fmvValue, setFmvValue] = useState('');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [treasury, withdrawalRows] = await Promise.all([
        apiFetch<TreasuryStatus>('/admin/buyback/treasury'),
        apiFetch<WithdrawalRow[]>('/admin/payments/withdrawals'),
      ]);
      setStatus(treasury);
      setWithdrawals(withdrawalRows);
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

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Withdrawal queue</p>
            <p className="text-xs text-white/45">KYC-approved money-out requests.</p>
          </div>
          <button onClick={load} className="text-xs text-white/50 underline hover:text-white">
            Refresh
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="text-left text-white/45">
              <tr>
                <th className="py-2 font-medium">User</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Destination</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-white/5">
                  <td className="py-2 pr-3">
                    <div>{w.buyer?.email ?? w.buyer?.walletAddress ?? w.id}</div>
                    <div className="text-xs text-white/35">KYC {w.buyer?.kycStatus ?? '-'}</div>
                  </td>
                  <td className="py-2 pr-3">{usd(w.amountUsdc)}</td>
                  <td className="max-w-[18rem] truncate py-2 pr-3 text-white/55">
                    {w.metadata?.destinationType ?? 'USDC'} · {w.metadata?.destination ?? '-'}
                  </td>
                  <td className="py-2 pr-3">{w.status}</td>
                  <td className="py-2">
                    {w.status === 'PROCESSING' || w.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            run(() =>
                              apiFetch(`/admin/payments/withdrawals/${w.id}/complete`, {
                                method: 'POST',
                              }),
                            )
                          }
                          className="rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-semibold text-black"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() =>
                            run(() =>
                              apiFetch(`/admin/payments/withdrawals/${w.id}/fail`, {
                                method: 'POST',
                                body: JSON.stringify({ reason: 'Manual ops failure' }),
                              }),
                            )
                          }
                          className="rounded-lg border border-red-400/40 px-2.5 py-1.5 text-xs text-red-200"
                        >
                          Fail + refund
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-white/35">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-white/35">
                    No withdrawals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
