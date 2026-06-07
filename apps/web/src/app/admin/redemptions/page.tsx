'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isStaff, type RedemptionRow } from '@/lib/types';

export default function AdminRedemptionsPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [rows, setRows] = useState<RedemptionRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setRows(await apiFetch<RedemptionRow[]>('/admin/redemptions'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const act = async (id: string, path: string, body?: object) => {
    try {
      await apiFetch(`/admin/redemptions/${id}/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Redemption fulfilment</h1>
      <p className="text-sm text-white/55">Ship out redeemed physical cards and track delivery.</p>
      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div>
              <span className="font-semibold">{r.vaultItem.physicalCard.cardName}</span>
              <span className="ml-2 text-xs text-white/45">
                {r.vaultItem.physicalCard.grader} {r.vaultItem.physicalCard.grade}
              </span>
              <div className="text-xs text-white/35">by {r.user?.email ?? r.user?.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                {r.status}
              </span>
              {r.status === 'REQUESTED' && (
                <button
                  onClick={() => {
                    const t = window.prompt('Tracking number:');
                    if (t) act(r.id, 'ship', { trackingNumber: t });
                  }}
                  className="h-9 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-black"
                >
                  Mark shipped
                </button>
              )}
              {r.status === 'SHIPPED' && (
                <button
                  onClick={() => act(r.id, 'delivered')}
                  className="h-9 rounded-lg border border-white/15 px-3 text-sm"
                >
                  Mark delivered
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-white/40">No redemptions.</p>}
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
