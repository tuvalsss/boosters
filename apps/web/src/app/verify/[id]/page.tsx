'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicFetch } from '@/lib/api';
import type { VerifyOpening } from '@/lib/types';

/**
 * Public provably-fair verification. Reproduces the draw in-browser from the
 * revealed opening record and confirms it matches the recorded result —
 * including checking sha256(serverSeed) === the published commitment.
 */
export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [op, setOp] = useState<VerifyOpening | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [check, setCheck] = useState<{ ok: boolean; reasons: string[] } | null>(null);

  const verify = useCallback(async (o: VerifyOpening) => {
    if (!o.serverSeed || !o.proof?.candidates) return;
    const reasons: string[] = [];
    const enc = new TextEncoder();

    // 1) Commitment: sha256(serverSeed) === serverSeedHash
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(o.serverSeed));
    const hashHex = [...new Uint8Array(hashBuf)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hashHex !== o.serverSeedHash) reasons.push('serverSeed does not match the commitment hash');

    // 2) Draw: HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`) → weighted pick
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(o.serverSeed),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${o.clientSeed}:${o.nonce}`));
    const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const float = parseInt(sigHex.slice(0, 8), 16) / 0x100000000;

    const candidates = o.proof.candidates;
    const total = candidates.reduce((s, c) => s + Math.max(c.weight, 0), 0);
    let target = float * total;
    let idx = candidates.length - 1;
    for (let i = 0; i < candidates.length; i++) {
      target -= Math.max(candidates[i]!.weight, 0);
      if (target < 0) {
        idx = i;
        break;
      }
    }
    if (candidates[idx]!.vaultItemId !== o.resultVaultItemId) {
      reasons.push('recomputed winner does not match the recorded result');
    }
    setCheck({ ok: reasons.length === 0, reasons });
  }, []);

  useEffect(() => {
    publicFetch<VerifyOpening>(`/packs/openings/${id}`)
      .then((o) => {
        setOp(o);
        void verify(o);
      })
      .catch((e) => setErr((e as Error).message));
  }, [id, verify]);

  if (err) return <Center>{err}</Center>;
  if (!op) return <Center>Loading…</Center>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Verify draw</h1>
      <p className="text-sm text-white/55">
        Pack: {op.pack?.name} · Opening {op.id}
      </p>

      {op.status !== 'SETTLED' && op.status !== 'REVEALED' ? (
        <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-white/60">
          This opening has not been revealed yet.
        </p>
      ) : (
        <>
          <div
            className={`mt-6 rounded-2xl border p-5 ${
              check?.ok
                ? 'border-emerald-400/40 bg-emerald-400/5'
                : check
                  ? 'border-red-400/40 bg-red-400/5'
                  : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <p className="text-lg font-semibold">
              {check
                ? check.ok
                  ? '✓ Verified — result is provably fair'
                  : '✗ Verification failed'
                : 'Verifying…'}
            </p>
            {check && !check.ok && (
              <ul className="mt-2 list-disc pl-5 text-sm text-red-300">
                {check.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-white/45">
              Recomputed in your browser with the Web Crypto API from the values below.
            </p>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <Row k="Result" v={op.result?.physicalCard.cardName ?? op.resultVaultItemId ?? '—'} />
            <Row k="Algorithm" v={op.proof?.algorithm ?? '—'} mono />
            <Row k="Server seed hash (committed before)" v={op.serverSeedHash} mono />
            <Row k="Server seed (revealed after)" v={op.serverSeed ?? '—'} mono />
            <Row k="Client seed" v={op.clientSeed} mono />
            <Row k="Nonce" v={String(op.nonce)} mono />
            <Row k="Entropy (HMAC head)" v={op.proof?.floatHex ?? '—'} mono />
            <Row k="Float" v={op.proof?.float != null ? op.proof.float.toFixed(8) : '—'} mono />
          </dl>
        </>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-white/5 pb-2">
      <dt className="text-white/45">{k}</dt>
      <dd className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
