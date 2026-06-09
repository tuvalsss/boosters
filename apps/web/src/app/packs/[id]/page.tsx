'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { publicFetch, usd } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BRANCHES } from '@/lib/branches';
import { packAssetsFor } from '@/lib/pack-assets';
import type { PackDetail, PackOpening, VerifyOpening } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';
import { ArrowRightIcon } from '@/components/icons';
import { PackArt } from '@/components/pack-art';

type Phase = 'idle' | 'opening' | 'done';

export default function PackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated, login, apiFetch, refreshMe } = useAuth();
  const { t } = useI18n();
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [won, setWon] = useState<VerifyOpening | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<PackOpening | null>(null);
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
  if (!pack) return <Center>Loading...</Center>;

  const fallbackBranch = BRANCHES[Math.abs(hash(pack.id)) % BRANCHES.length]!;
  const packAssets = packAssetsFor(pack.coverImageUrl, fallbackBranch);
  const previewPrizeImage =
    won?.result?.physicalCard.photos?.[0]?.url ?? fallbackBranch.cardImages[0];

  const open = async () => {
    if (!authenticated) return login();
    setErr(null);
    setWon(null);
    setCommitment(null);
    setPhase('opening');
    try {
      const committed = await apiFetch<PackOpening>(`/packs/${id}/open`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setOpeningId(committed.id);
      setCommitment(committed);
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
        Back to all packs
      </Link>

      <div className="mt-4 flex flex-col items-center text-center">
        <div className="relative flex h-[21rem] w-full max-w-sm justify-center transition">
          {phase === 'idle' ? (
            <div className="pack-3d-stage h-72 w-56">
              <div className="pack-3d-card h-full w-full">
                <div className="pack-face pack-face-front">
                  <PackArt src={packAssets.front} alt={pack.name} className="h-full" />
                </div>
                <div className="pack-face pack-face-back">
                  <PackArt src={packAssets.back} alt="" className="h-full" />
                </div>
              </div>
            </div>
          ) : (
            <div
              className={[
                'pack-open-stage h-72 w-64',
                phase === 'opening' ? 'is-opening' : 'is-revealed',
              ].join(' ')}
            >
              <span
                className="pack-open-glow"
                style={{
                  background: `radial-gradient(circle at 50% 34%, ${pack.accentColor}66, transparent 64%)`,
                }}
              />
              <PackArt
                src={packAssets.opened}
                alt={`${pack.name} opened pack`}
                className="pack-opened-image h-full"
              />
              <div className={`pack-emerging-card ${phase === 'done' ? 'is-revealed' : ''}`}>
                <span className="hit-card-aura" style={{ backgroundColor: pack.accentColor }} />
                <Image
                  src={previewPrizeImage}
                  alt=""
                  width={500}
                  height={700}
                  className="hit-card-image h-52 w-auto rounded-xl"
                />
                <span className="hit-card-shine" />
                <span className="hit-card-scan" />
              </div>
            </div>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{pack.name}</h1>
        {pack.description && <p className="mt-2 max-w-lg text-white/55">{pack.description}</p>}
        <p className="text-white/55">
          {pack.remaining} cards left / {usd(pack.priceUsdc)}
        </p>

        {phase !== 'done' && (
          <button
            onClick={open}
            disabled={phase === 'opening' || pack.remaining === 0}
            className="mt-6 rounded-full bg-white px-10 py-3.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {phase === 'opening'
              ? 'Opening...'
              : pack.remaining === 0
                ? t('packs.soldOut')
                : authenticated
                  ? `${t('packs.openFor')} ${usd(pack.priceUsdc)}`
                  : t('packs.loginToOpen')}
          </button>
        )}
        {!authenticated && phase !== 'done' && (
          <Link
            href="/demo"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
          >
            {t('packs.tryDemo')} <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
        {err && <p className="mt-4 text-sm text-red-300">{err}</p>}
        {(phase === 'opening' || phase === 'done') && <RealPrizeReel pack={pack} phase={phase} />}
        {phase === 'opening' && commitment && (
          <div className="mt-5 w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200/70">
              Seed committed before reveal
            </p>
            <p className="mt-2 break-all font-mono text-xs text-white/65">
              {commitment.serverSeedHash}
            </p>
            <p className="mt-2 text-xs text-white/40">
              Provider: {commitment.randomnessProvider ?? 'commit-reveal'}
              {commitment.fairnessCommitTx ? ' / Solana memo anchored' : ' / local commit'}
            </p>
          </div>
        )}
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

function RealPrizeReel({ pack, phase }: { pack: PackDetail; phase: Phase }) {
  const available = pack.pool.filter((p) => !p.consumed);
  const source = available.length ? available : pack.pool;
  const items = Array.from({ length: 8 }, () => source).flat();

  if (items.length === 0) return null;

  return (
    <div className="relative mt-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-black/60 py-3 shadow-2xl">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-emerald-200 shadow-[0_0_22px_rgba(110,231,183,0.9)]" />
      <div
        className={[
          'roulette-track flex gap-3 pl-[calc(50%-4.5rem)]',
          phase === 'done' ? 'is-idle' : '',
        ].join(' ')}
        style={{ transform: phase === 'opening' ? 'translateX(-58rem)' : 'translateX(-18rem)' }}
      >
        {items.map((entry, index) => (
          <div
            key={`${entry.poolItemId}-${index}`}
            className="w-36 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-left"
          >
            <p className="truncate text-xs font-bold text-white">{entry.card.cardName}</p>
            <p className="mt-1 truncate text-[11px] text-white/45">
              {entry.card.grader} {entry.card.grade ?? ''} / {entry.tier ?? 'default'}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-emerald-200">
              {entry.consumed ? 'pulled' : `${entry.oddsPct}% odds`}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-widest text-white/35">
        {phase === 'opening' ? 'Roulette is landing' : 'Result settled'}
      </p>
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
