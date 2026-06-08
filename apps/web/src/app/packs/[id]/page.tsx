'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { publicFetch, usd } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BRANCHES } from '@/lib/branches';
import type { PackDetail, PackOpening, VerifyOpening } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';

type Phase = 'idle' | 'opening' | 'done';

export default function PackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated, login, apiFetch, refreshMe } = useAuth();
  const { t } = useI18n();
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [won, setWon] = useState<VerifyOpening | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPack(await publicFetch<PackDetail>(`/packs/${id}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <Center>{err}</Center>;
  if (!pack) return <Center>Loading…</Center>;

  const packImage =
    pack.coverImageUrl ?? BRANCHES[Math.abs(hash(pack.id)) % BRANCHES.length]!.packImage;

  const open = async () => {
    if (!authenticated) return login();
    setErr(null);
    setPhase('opening');
    try {
      const committed = await apiFetch<PackOpening>(`/packs/${id}/open`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setOpeningId(committed.id);
      // Brief suspense while the (already-committed) draw settles.
      await new Promise((r) => setTimeout(r, 1400));
      await apiFetch<PackOpening>(`/packs/openings/${committed.id}/reveal`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const result = await publicFetch<VerifyOpening>(`/packs/openings/${committed.id}`);
      setWon(result);
      setPhase('done');
      await refreshMe();
      await load();
    } catch (e) {
      setErr((e as Error).message);
      setPhase('idle');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <Link href="/packs" className="text-sm text-white/50 hover:text-white">
        ← All packs
      </Link>

      <div className="mt-4 flex flex-col items-center text-center">
        <div
          className={[
            'relative h-72 w-48 transition',
            phase === 'opening' ? 'animate-pack-pop' : '',
          ].join(' ')}
        >
          <Image src={packImage} alt={pack.name} fill className="object-contain drop-shadow-2xl" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{pack.name}</h1>
        {pack.description && <p className="mt-2 max-w-lg text-white/55">{pack.description}</p>}
        <p className="text-white/55">
          {pack.remaining} cards left · {usd(pack.priceUsdc)}
        </p>

        {phase !== 'done' && (
          <button
            onClick={open}
            disabled={phase === 'opening' || pack.remaining === 0}
            className="mt-6 rounded-full bg-white px-10 py-3.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {phase === 'opening'
              ? 'Opening…'
              : pack.remaining === 0
                ? t('packs.soldOut')
                : authenticated
                  ? `${t('packs.openFor')} ${usd(pack.priceUsdc)}`
                  : t('packs.loginToOpen')}
          </button>
        )}
        {err && <p className="mt-4 text-sm text-red-300">{err}</p>}
      </div>

      {phase === 'done' && won && (
        <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-6 text-center">
          <p className="text-xs uppercase tracking-widest text-emerald-300/70">You pulled</p>
          <h2 className="mt-1 text-2xl font-bold">{won.result?.physicalCard.cardName}</h2>
          <p className="text-white/60">
            {won.result?.physicalCard.grader} {won.result?.physicalCard.grade}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/portfolio"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
            >
              View in portfolio
            </Link>
            {openingId && (
              <Link
                href={`/verify/${openingId}`}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium hover:bg-white/5"
              >
                Verify this draw
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Transparent odds */}
      <h3 className="mb-2 mt-10 text-sm font-semibold uppercase tracking-wide text-white/50">
        Pool &amp; odds
      </h3>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <tbody>
            {pack.pool.map((p) => (
              <tr
                key={p.poolItemId}
                className={`border-t border-white/5 ${p.consumed ? 'text-white/30 line-through' : ''}`}
              >
                <td className="px-4 py-2">{p.card.cardName}</td>
                <td className="px-4 py-2 text-white/45">
                  {p.card.grader} {p.card.grade}
                </td>
                <td className="px-4 py-2 text-right text-white/60">
                  {p.consumed ? 'pulled' : `${p.oddsPct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
