'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, BoltIcon, LayersIcon, SparkleIcon, TrophyIcon } from '@/components/icons';
import { PackArt } from '@/components/pack-art';
import { useI18n } from '@/i18n/language-context';
import { publicFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BRANCHES, type Branch } from '@/lib/branches';
import type { EbayCardListing } from '@/lib/types';

type Phase = 'idle' | 'opening' | 'revealed';

interface DemoPrize {
  id: string;
  name: string;
  rarity: string;
  value: number;
  image: string;
  accent: string;
  sourceUrl: string;
  seller: string | null;
  grade: string | null;
}

const REEL_ITEM_WIDTH_REM = 9.75;

export default function DemoPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [selectedKey, setSelectedKey] = useState(BRANCHES[0]!.key);
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultIndex, setResultIndex] = useState(0);
  const [targetSlot, setTargetSlot] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [livePrizes, setLivePrizes] = useState<DemoPrize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [prizeError, setPrizeError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const selectedIndex = Math.max(
    0,
    BRANCHES.findIndex((branch) => branch.key === selectedKey),
  );
  const selected = BRANCHES[selectedIndex] ?? BRANCHES[0]!;
  const result = livePrizes.length ? livePrizes[resultIndex % livePrizes.length]! : null;
  const resultAccent = result?.accent ?? selected.accent;
  const rouletteItems = useMemo(() => buildRouletteItems(livePrizes), [livePrizes]);
  const canOpen = livePrizes.length > 0 && !loadingPrizes;

  useEffect(() => {
    let mounted = true;
    setLoadingPrizes(true);
    publicFetch<EbayCardListing[]>('/catalog/ebay-prizes?take=32')
      .then((rows) => {
        if (!mounted) return;
        setLivePrizes(rows.map(prizeFromListing));
        setPrizeError(null);
        setResultIndex(0);
        setTargetSlot(0);
        setPhase('idle');
      })
      .catch((error) => {
        if (!mounted) return;
        setLivePrizes([]);
        setPrizeError((error as Error).message);
      })
      .finally(() => {
        if (mounted) setLoadingPrizes(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const openPack = () => {
    if (phase === 'opening' || !canOpen) return;
    if (timer.current) window.clearTimeout(timer.current);

    const prizeCount = livePrizes.length;
    const nextResultIndex = (selectedIndex * 3 + openCount) % prizeCount;
    const nextSlot = 10 + (2 + (openCount % 4)) * prizeCount + nextResultIndex;
    setResultIndex(nextResultIndex);
    setTargetSlot(nextSlot);
    setPhase('opening');

    timer.current = window.setTimeout(() => {
      setPhase('revealed');
      setOpenCount((count) => count + 1);
    }, 2500);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <section className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="flex min-h-[34rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
              <SparkleIcon className="h-3.5 w-3.5" /> {t('demo.eyebrow')}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {t('demo.title')} <span className="text-white/55">{t('demo.titleMuted')}</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              {t('demo.subtitle')}
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <DemoStat icon={<BoltIcon />} label={t('demo.benefitOdds')} value="provably fair" />
            <DemoStat icon={<LayersIcon />} label={t('demo.benefitVault')} value="eBay sourced" />
            <DemoStat icon={<TrophyIcon />} label={t('demo.benefitKyc')} value="withdrawals" />
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={login}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-black transition hover:bg-white/90"
            >
              {t('demo.join')}
            </button>
            <Link
              href="/packs"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white/90 transition hover:bg-white/[0.08]"
            >
              {t('demo.viewPacks')} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101216] p-4 shadow-2xl shadow-black/30 sm:p-6">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at 78% 18%, ${selected.accent}55, transparent 34%), radial-gradient(circle at 10% 72%, ${resultAccent}30, transparent 38%)`,
            }}
          />

          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                {t('demo.preview')}
              </p>
              <h2 className="mt-1 text-xl font-bold">{selected.name}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white/70">
              {loadingPrizes
                ? t('demo.loadingListings')
                : livePrizes.length
                  ? `${livePrizes.length} ${t('demo.ebayPrizes')}`
                  : t('demo.importRequired')}
            </span>
          </div>

          <PackCarousel selected={selected} onSelect={(branch) => setSelectedKey(branch.key)} />

          <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="relative flex min-h-[24rem] items-center justify-center">
              <div
                className={[
                  'absolute h-72 w-56 rounded-[2rem] opacity-40 blur-3xl transition duration-700',
                  phase === 'opening' ? 'scale-125' : 'scale-100',
                ].join(' ')}
                style={{ backgroundColor: selected.accent }}
              />

              <PackRevealStage branch={selected} phase={phase} result={result} />

              {rouletteItems.length > 0 && (
                <div
                  className={[
                    'absolute inset-x-0 bottom-2 z-30 transition duration-500',
                    phase === 'idle' ? 'translate-y-5 opacity-0' : 'translate-y-0 opacity-100',
                  ].join(' ')}
                >
                  <RouletteReel phase={phase} targetSlot={targetSlot} items={rouletteItems} />
                </div>
              )}

              {phase === 'revealed' && result && <WinnerReveal result={result} />}

              {!loadingPrizes && livePrizes.length === 0 && (
                <LiveEbayEmptyState error={prizeError} />
              )}

              {loadingPrizes && (
                <div className="relative z-30 rounded-2xl border border-white/10 bg-black/65 px-5 py-4 text-center shadow-2xl backdrop-blur">
                  <p className="text-sm font-bold text-white">{t('demo.loadingListings')}</p>
                  <p className="mt-1 text-xs text-white/45">{t('demo.liveEbay')}</p>
                </div>
              )}
            </div>

            <div className="relative mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-semibold text-white/45">{t('demo.selected')}</p>
                <p className="mt-1 text-sm font-semibold">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={openPack}
                disabled={phase === 'opening' || !canOpen}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-300 px-6 text-sm font-extrabold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loadingPrizes
                  ? t('demo.loadingListings')
                  : !canOpen
                    ? t('demo.importRequired')
                    : phase === 'opening'
                      ? t('demo.spinning')
                      : phase === 'revealed'
                        ? t('demo.openAgain')
                        : t('demo.spin')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              {t('demo.prizeLineup')}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{t('demo.conversionTitle')}</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/55">{t('demo.conversionCopy')}</p>
        </div>
        {livePrizes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-8 text-center">
            <p className="text-sm font-bold text-white">{t('demo.importTitle')}</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/50">
              {t('demo.importCopy')}
            </p>
            <code className="mt-4 inline-flex rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/65">
              pnpm ebay:import-cards -- --limit 100
            </code>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {livePrizes.slice(0, 8).map((prize) => (
              <a
                key={prize.id}
                href={prize.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[4rem_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span className="relative h-20 overflow-hidden rounded-xl bg-black/30">
                  <Image src={prize.image} alt="" fill className="object-contain p-1" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{prize.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-emerald-200">
                    {prize.rarity} / {formatMoney(prize.value)}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-white/35">
                    {t('demo.sourceLabel')}: eBay
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PackCarousel({
  selected,
  onSelect,
}: {
  selected: Branch;
  onSelect: (branch: Branch) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="relative mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
          {t('demo.packCarousel')}
        </p>
        <p className="text-xs text-white/40">{t('demo.carouselHint')}</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory]">
        {BRANCHES.map((branch, index) => {
          const active = branch.key === selected.key;
          return (
            <button
              key={branch.key}
              type="button"
              onClick={() => onSelect(branch)}
              className={[
                'group relative min-w-[8.25rem] scroll-ml-4 overflow-hidden rounded-2xl border p-3 text-left transition [scroll-snap-align:start]',
                active
                  ? 'border-white/35 bg-white/[0.09]'
                  : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]',
              ].join(' ')}
            >
              <span
                className="absolute inset-0 opacity-60"
                style={{ background: `linear-gradient(145deg, ${branch.accent}35, transparent)` }}
              />
              <span className="relative mx-auto flex h-28 items-center justify-center">
                <PackArt
                  src={branch.packImage}
                  alt=""
                  className={[
                    'h-28 transition group-hover:-translate-y-1',
                    active ? 'carousel-breathe pack-mini-selected' : '',
                  ].join(' ')}
                  imageClassName="drop-shadow-xl"
                  style={{ animationDelay: `${index * 0.15}s` }}
                />
              </span>
              <span className="relative mt-2 block truncate text-xs font-bold text-white">
                {branch.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PackRevealStage({
  branch,
  phase,
  result,
}: {
  branch: Branch;
  phase: Phase;
  result: DemoPrize | null;
}) {
  return (
    <div className="absolute top-3 z-10 flex h-[20rem] w-full items-start justify-center sm:top-1">
      {phase === 'idle' ? (
        <div key={branch.key} className="pack-3d-stage h-72 w-56 sm:h-80">
          <div className="pack-3d-card h-full w-full">
            <div className="pack-face pack-face-front">
              <PackArt
                src={branch.packImage}
                alt={`${branch.name} demo pack`}
                className="h-full"
                imageClassName="drop-shadow-2xl"
              />
            </div>
            <div className="pack-face pack-face-back">
              <PackArt
                src={branch.packBackImage}
                alt=""
                className="h-full"
                imageClassName="drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          key={`${branch.key}-${phase}`}
          className={[
            'pack-open-stage h-72 w-64 sm:h-80 sm:w-72',
            phase === 'opening' ? 'is-opening' : 'is-revealed',
          ].join(' ')}
        >
          <span
            className="pack-open-glow"
            style={{
              background: `radial-gradient(circle at 50% 34%, ${branch.accent}66, transparent 64%)`,
            }}
          />
          <PackArt
            src={branch.packOpenedImage}
            alt={`${branch.name} opened pack`}
            className="pack-opened-image h-full"
            imageClassName="drop-shadow-2xl"
          />
          {result && (
            <div className={`pack-emerging-card ${phase === 'revealed' ? 'is-revealed' : ''}`}>
              <span className="hit-card-aura" style={{ backgroundColor: result.accent }} />
              <Image
                src={result.image}
                alt={result.name}
                width={500}
                height={700}
                className="hit-card-image h-52 w-auto rounded-xl object-contain sm:h-60"
              />
              <span className="hit-card-shine" />
              <span className="hit-card-scan" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RouletteReel({
  phase,
  targetSlot,
  items,
}: {
  phase: Phase;
  targetSlot: number;
  items: DemoPrize[];
}) {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/70 py-3 shadow-2xl backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-emerald-200 shadow-[0_0_22px_rgba(110,231,183,0.9)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-emerald-200" />
      <div
        className={[
          'roulette-track flex gap-3 pl-[calc(50%-4.5rem)]',
          phase === 'idle' ? 'is-idle' : '',
        ].join(' ')}
        style={{ transform: `translateX(-${targetSlot * REEL_ITEM_WIDTH_REM}rem)` }}
      >
        {items.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className="grid w-36 shrink-0 grid-cols-[2.7rem_1fr] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-2"
          >
            <span className="relative h-12 overflow-hidden rounded-lg bg-black/30">
              <Image src={item.image} alt="" fill className="object-contain p-1" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-white">{item.name}</span>
              <span className="block text-[11px] text-emerald-200">
                {item.rarity} / {formatMoney(item.value)}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-widest text-white/35">
        {phase === 'opening' ? t('demo.rouletteRunning') : t('demo.rouletteReady')}
      </p>
    </div>
  );
}

function WinnerReveal({ result }: { result: DemoPrize }) {
  const { t } = useI18n();
  return (
    <div className="winner-pop absolute right-3 top-3 z-40 w-56 rounded-xl border border-white/10 bg-black/70 p-3 text-left shadow-2xl backdrop-blur">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
        {t('demo.resultLabel')}
      </p>
      <p className="mt-1 truncate font-bold">{result.name}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">{result.rarity}</span>
        <span className="rounded-full bg-emerald-400 px-2.5 py-1 font-bold text-black">
          {formatMoney(result.value)}
        </span>
        <a
          href={result.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 px-2.5 py-1 text-white/70 hover:text-white"
        >
          {t('demo.viewListing')}
        </a>
      </div>
    </div>
  );
}

function LiveEbayEmptyState({ error }: { error: string | null }) {
  const { t } = useI18n();
  return (
    <div className="relative z-30 mx-auto max-w-md rounded-2xl border border-white/10 bg-black/70 p-5 text-center shadow-2xl backdrop-blur">
      <p className="text-sm font-extrabold text-white">{t('demo.importTitle')}</p>
      <p className="mt-2 text-sm leading-6 text-white/55">{t('demo.importCopy')}</p>
      <code className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/70">
        pnpm ebay:import-cards -- --limit 100
      </code>
      {error && <p className="mt-3 text-xs text-amber-200/75">{t('demo.loadError')}</p>}
    </div>
  );
}

function DemoStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
        {icon}
      </span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white/85">{value}</p>
    </div>
  );
}

function buildRouletteItems(prizes: DemoPrize[]): DemoPrize[] {
  if (!prizes.length) return [];
  const repeats = Math.max(6, Math.ceil(150 / prizes.length));
  return Array.from({ length: repeats }, () => prizes).flat();
}

function prizeFromListing(listing: EbayCardListing): DemoPrize {
  const value = Number(listing.priceValue);
  return {
    id: listing.id,
    name: listing.cardName || listing.title,
    rarity: rarityFromTier(listing.tier),
    value: Number.isFinite(value) ? value : 0,
    image: listing.imageUrl,
    accent: accentForListing(listing),
    sourceUrl: listing.itemAffiliateWebUrl ?? listing.itemWebUrl,
    seller: listing.sellerUsername,
    grade: listing.grade,
  };
}

function rarityFromTier(tier: string): string {
  const normalized = tier.trim().toUpperCase();
  if (normalized === 'GRAIL') return 'GRAIL';
  if (normalized === 'CHASE') return 'CHASE';
  if (normalized === 'RARE') return 'RARE';
  if (normalized === 'UNCOMMON') return 'UNCOMMON';
  return 'COMMON';
}

function accentForListing(listing: EbayCardListing): string {
  if (listing.tier === 'grail') return '#facc15';
  if (listing.tier === 'chase') return '#fb7185';
  if (listing.tier === 'rare') return '#22d3ee';
  if (listing.category === 'POKEMON') return '#60a5fa';
  if (listing.category === 'SPORTS') return '#f87171';
  if (listing.category === 'TCG') return '#a78bfa';
  return '#86efac';
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 0 : 2 })}`;
}
