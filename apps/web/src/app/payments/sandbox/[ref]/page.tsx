'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';

/**
 * Sandbox checkout. Stands in for the Coinflow hosted flow on devnet: confirming
 * triggers the real ledger credit (a DEPOSIT). Live mode uses the Coinflow
 * webhook instead and this page is skipped.
 */
export default function SandboxCheckoutPage() {
  const { ref } = useParams<{ ref: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const amount = params.get('amount') ?? '';

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/payments/sandbox/${ref}/confirm`, { method: 'POST' });
      setDone(true);
      setTimeout(() => router.push('/portfolio'), 1000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <span className="inline-block rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
          sandbox checkout
        </span>
        <h1 className="mt-4 text-2xl font-bold">Add {amount ? usd(amount) : 'funds'}</h1>
        <p className="mt-2 text-sm text-white/55">
          No real payment is taken. Confirming credits your devnet USDC balance.
        </p>

        {done ? (
          <p className="mt-6 text-emerald-300">Payment confirmed — redirecting…</p>
        ) : (
          <button
            onClick={confirm}
            disabled={busy}
            className="mt-6 w-full rounded-full bg-white py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {busy ? 'Confirming…' : 'Confirm payment'}
          </button>
        )}
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      </div>
    </div>
  );
}
