'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';
import { isStaff } from '@/lib/types';

interface HeldListing {
  id: string;
  priceUsdc: string;
  heldReason: string | null;
  vaultItem: { physicalCard: { cardName: string; grader: string; grade: string | null } };
  seller: { id: string; email: string | null };
}

export default function ReviewPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [rows, setRows] = useState<HeldListing[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setRows(await apiFetch<HeldListing[]>('/admin/review/listings'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const review = async (id: string, action: 'approve' | 'reject') => {
    try {
      await apiFetch(`/admin/review/listings/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
      <p className="text-sm text-white/55">
        Listings auto-held for pricing far from FMV (anti-manipulation). Approve to publish or
        reject to cancel.
      </p>
      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4"
          >
            <div>
              <span className="font-semibold">{r.vaultItem.physicalCard.cardName}</span>
              <span className="ml-2 text-xs text-white/45">
                {r.vaultItem.physicalCard.grader} {r.vaultItem.physicalCard.grade} ·{' '}
                {usd(r.priceUsdc)}
              </span>
              <div className="text-xs text-amber-300/80">{r.heldReason}</div>
              <div className="text-xs text-white/35">by {r.seller.email ?? r.seller.id}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => review(r.id, 'approve')}
                className="h-9 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-black"
              >
                Approve
              </button>
              <button
                onClick={() => review(r.id, 'reject')}
                className="h-9 rounded-lg border border-white/15 px-3 text-sm"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-white/40">Nothing to review.</p>}
      </div>
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
