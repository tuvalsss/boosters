'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, BoltIcon, LayersIcon, SparkleIcon, TrophyIcon } from '@/components/icons';
import { useI18n } from '@/i18n/language-context';
import { BRANCHES } from '@/lib/branches';
import { useAuth } from '@/lib/auth-context';

type Phase = 'idle' | 'opening' | 'revealed';

const DEMO_RESULTS = [
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

export default function DemoPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [selectedKey, setSelectedKey] = useState(BRANCHES[0]!.key);
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultIndex, setResultIndex] = useState(0);
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
    setResultIndex((selectedIndex * 2 + openCount) % DEMO_RESULTS.length);
    setPhase('opening');
    timer.current = window.setTimeout(() => {
      setPhase('revealed');
      setOpenCount((count) => count + 1);
    }, 1050);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="flex min-h-[32rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
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

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111216] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `radial-gradient(circle at 70% 20%, ${selected.accent}55, transparent 34%), radial-gradient(circle at 10% 80%, ${result.accent}33, transparent 36%)`,
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
              {t('demo.demoOnly')}
            </span>
          </div>

          <div className="relative mt-8 flex min-h-[24rem] items-center justify-center">
            <div
              className={[
                'absolute h-64 w-44 rounded-[2rem] opacity-40 blur-3xl transition duration-700',
                phase === 'opening' ? 'scale-125' : 'scale-100',
              ].join(' ')}
              style={{ backgroundColor: selected.accent }}
            />
            <Image
              src={selected.packImage}
              alt={`${selected.name} demo pack`}
              width={600}
              height={900}
              priority
              className={[
                'relative z-10 h-72 w-auto rounded-2xl drop-shadow-2xl transition duration-700 sm:h-80',
                phase === 'opening' ? 'scale-110 -rotate-6 blur-[1px]' : '',
                phase === 'revealed' ? '-translate-x-16 -rotate-12 opacity-50' : '',
              ].join(' ')}
            />
            <div
              aria-live="polite"
              className={[
                'absolute z-20 flex flex-col items-center transition duration-700',
                phase === 'revealed'
                  ? 'translate-x-16 scale-100 opacity-100'
                  : 'translate-x-20 scale-95 opacity-0',
              ].join(' ')}
            >
              <Image
                src={result.image}
                alt={result.name}
                width={500}
                height={700}
                className="h-72 w-auto rounded-xl shadow-2xl ring-1 ring-white/20 sm:h-80"
              />
              <div className="mt-4 w-64 rounded-xl border border-white/10 bg-black/55 p-3 text-center backdrop-blur">
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
                ? t('demo.opening')
                : phase === 'revealed'
                  ? t('demo.openAgain')
                  : t('demo.open')}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              {t('demo.choosePack')}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{t('demo.conversionTitle')}</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/55">{t('demo.conversionCopy')}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BRANCHES.map((branch) => {
            const active = branch.key === selectedKey;
            return (
              <button
                key={branch.key}
                type="button"
                onClick={() => {
                  setSelectedKey(branch.key);
                  setPhase('idle');
                }}
                className={[
                  'group grid grid-cols-[4rem_1fr] items-center gap-3 rounded-2xl border p-3 text-left transition',
                  active
                    ? 'border-white/30 bg-white/[0.08]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                ].join(' ')}
              >
                <span className="relative h-20 overflow-hidden rounded-xl bg-black/30">
                  <Image
                    src={branch.packImage}
                    alt=""
                    fill
                    className="object-contain p-2 transition group-hover:-translate-y-1"
                  />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white">{branch.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/50">
                    {branch.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
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
