'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, BoltIcon, LayersIcon, SparkleIcon, TrophyIcon } from '@/components/icons';
import { PackArt } from '@/components/pack-art';
import { useI18n } from '@/i18n/language-context';
import { BRANCHES, type Branch } from '@/lib/branches';
import { useAuth } from '@/lib/auth-context';

type Phase = 'idle' | 'opening' | 'revealed';

interface DemoPrize {
  name: string;
  rarity: string;
  value: number;
  image: string;
  accent: string;
}

const DEMO_RESULTS: DemoPrize[] = [
  {
    name: 'Volt Crown Alpha',
    rarity: 'MYTHIC',
    value: 312,
    image: '/assets/brand-cards/creature-card.svg',
    accent: '#facc15',
  },
  {
    name: 'Vault Gold Signature',
    rarity: 'LEGEND',
    value: 248,
    image: '/assets/brand-cards/gold-card.svg',
    accent: '#f59e0b',
  },
  {
    name: 'Ocean Relic PSA 10',
    rarity: 'RARE',
    value: 126,
    image: '/assets/brand-cards/adventure-card.svg',
    accent: '#22d3ee',
  },
  {
    name: 'Rookie Icon Gem',
    rarity: 'CHASE',
    value: 184,
    image: '/assets/brand-cards/sports-card.svg',
    accent: '#fb7185',
  },
];

const ROULETTE_ITEMS = Array.from({ length: 16 }, () => DEMO_RESULTS).flat();
const REEL_ITEM_WIDTH_REM = 9.75;

export default function DemoPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [selectedKey, setSelectedKey] = useState(BRANCHES[0]!.key);
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultIndex, setResultIndex] = useState(0);
  const [targetSlot, setTargetSlot] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const timer = useRef<number | null>(null);

  const selectedIndex = Math.max(
    0,
    BRANCHES.findIndex((branch) => branch.key === selectedKey),
  );
  const selected = BRANCHES[selectedIndex] ?? BRANCHES[0]!;
  const result = DEMO_RESULTS[resultIndex % DEMO_RESULTS.length]!;

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const openPack = () => {
    if (phase === 'opening') return;
    if (timer.current) window.clearTimeout(timer.current);

    const nextResultIndex = (selectedIndex * 2 + openCount) % DEMO_RESULTS.length;
    const nextSlot = 10 + openCount * DEMO_RESULTS.length + nextResultIndex;
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
            <DemoStat icon={<LayersIcon />} label={t('demo.benefitVault')} value="vault 1:1" />
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
              background: `radial-gradient(circle at 78% 18%, ${selected.accent}55, transparent 34%), radial-gradient(circle at 10% 72%, ${result.accent}30, transparent 38%)`,
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
              {DEMO_RESULTS.length} {t('demo.possiblePrizes')}
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

              <PackRipImage branch={selected} phase={phase} />

              <div
                className={[
                  'absolute inset-x-0 bottom-2 z-30 transition duration-500',
                  phase === 'idle' ? 'translate-y-5 opacity-0' : 'translate-y-0 opacity-100',
                ].join(' ')}
              >
                <RouletteReel phase={phase} targetSlot={targetSlot} />
              </div>

              {phase === 'revealed' && <WinnerReveal result={result} />}
            </div>

            <div className="relative mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-semibold text-white/45">{t('demo.selected')}</p>
                <p className="mt-1 text-sm font-semibold">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={openPack}
                disabled={phase === 'opening'}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-300 px-6 text-sm font-extrabold text-black transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
              >
                {phase === 'opening'
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_RESULTS.map((prize) => (
            <div
              key={prize.name}
              className="grid grid-cols-[4rem_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <span className="relative h-20 overflow-hidden rounded-xl bg-black/30">
                <Image src={prize.image} alt="" fill className="object-contain p-2" />
              </span>
              <span>
                <span className="block truncate text-sm font-bold text-white">{prize.name}</span>
                <span className="mt-1 block text-xs font-semibold text-emerald-200">
                  {prize.rarity} / ${prize.value}
                </span>
              </span>
            </div>
          ))}
        </div>
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
                    active ? 'carousel-breathe' : '',
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

function PackRipImage({ branch, phase }: { branch: Branch; phase: Phase }) {
  const showWholePack = phase === 'idle';
  const stateClass = phase === 'opening' ? 'is-opening' : phase === 'revealed' ? 'is-revealed' : '';

  return (
    <div className="absolute top-6 z-10 h-72 w-48 sm:h-80 sm:w-52">
      {showWholePack ? (
        <Image
          src={branch.packImage}
          alt={`${branch.name} demo pack`}
          width={600}
          height={900}
          priority
          className="h-full w-auto rounded-2xl drop-shadow-2xl transition duration-500"
        />
      ) : (
        <>
          <div
            className={`pack-rip-half pack-rip-left ${stateClass} absolute inset-y-0 left-0 w-1/2`}
          >
            <Image
              src={branch.packImage}
              alt=""
              width={600}
              height={900}
              className="absolute left-0 top-0 h-full w-[200%] max-w-none object-contain"
            />
          </div>
          <div
            className={`pack-rip-half pack-rip-right ${stateClass} absolute inset-y-0 right-0 w-1/2`}
          >
            <Image
              src={branch.packImage}
              alt=""
              width={600}
              height={900}
              className="absolute right-0 top-0 h-full w-[200%] max-w-none object-contain"
            />
          </div>
          <span
            className={`tear-flash ${phase === 'opening' ? 'is-opening' : ''} absolute left-1/2 top-4 z-20 h-[88%] w-1 rounded-full bg-white/80 shadow-[0_0_42px_rgba(255,255,255,0.7)]`}
          />
        </>
      )}
    </div>
  );
}

function RouletteReel({ phase, targetSlot }: { phase: Phase; targetSlot: number }) {
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
        {ROULETTE_ITEMS.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="grid w-36 shrink-0 grid-cols-[2.7rem_1fr] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-2"
          >
            <span className="relative h-12 overflow-hidden rounded-lg bg-black/30">
              <Image src={item.image} alt="" fill className="object-contain p-1" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-white">{item.name}</span>
              <span className="block text-[11px] text-emerald-200">
                {item.rarity} / ${item.value}
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
    <div className="winner-pop absolute top-2 z-20 flex flex-col items-center">
      <Image
        src={result.image}
        alt={result.name}
        width={500}
        height={700}
        className="h-72 w-auto rounded-xl shadow-2xl ring-1 ring-white/20 sm:h-80"
      />
      <div className="mt-3 w-64 rounded-xl border border-white/10 bg-black/65 p-3 text-center backdrop-blur">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          {t('demo.resultLabel')}
        </p>
        <p className="mt-1 truncate font-bold">{result.name}</p>
        <div className="mt-2 flex justify-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">
            {result.rarity}
          </span>
          <span className="rounded-full bg-emerald-400 px-2.5 py-1 font-bold text-black">
            ${result.value}
          </span>
        </div>
      </div>
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
