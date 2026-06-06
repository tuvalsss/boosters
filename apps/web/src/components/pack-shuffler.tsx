'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { BRANCHES } from '@/lib/branches';
import { ArrowLeftIcon, BoltIcon, ShuffleIcon, VolumeIcon } from './icons';

const N = BRANCHES.length;

/** Signed circular distance of slot `i` from the centered `index`, in [-N/2, N/2]. */
function rel(i: number, index: number): number {
  let d = i - index;
  if (d > N / 2) d -= N;
  if (d < -N / 2) d += N;
  return d;
}

/** Transform/style for a pack based on its distance from center. */
function slotStyle(d: number): React.CSSProperties {
  const abs = Math.abs(d);
  if (abs > 2) return { opacity: 0, transform: 'translateX(0) scale(0.4)', pointerEvents: 'none' };
  const x = d * 56; // % of container width
  const scale = 1 - abs * 0.2;
  const rotate = d * 16;
  return {
    transform: `translateX(${x}%) scale(${scale}) rotateZ(${rotate}deg)`,
    opacity: abs === 0 ? 1 : abs === 1 ? 0.85 : 0.4,
    zIndex: 30 - abs,
    filter: abs === 0 ? 'none' : 'brightness(0.7)',
  };
}

export function PackShuffler() {
  const [index, setIndex] = useState(0);
  const [shuffling, setShuffling] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const centerIdx = ((index % N) + N) % N;
  const center = BRANCHES[centerIdx]!;

  const shuffle = useCallback(() => {
    if (shuffling) return;
    setSelected(null);
    setShuffling(true);
    let ticks = 0;
    const total = 14 + Math.floor(Math.random() * 6);
    timer.current = setInterval(() => {
      setIndex((i) => i + 1);
      ticks += 1;
      if (ticks >= total) {
        if (timer.current) clearInterval(timer.current);
        setShuffling(false);
      }
    }, 90);
  }, [shuffling]);

  const onPackClick = (i: number) => {
    if (shuffling) return;
    const d = rel(i, centerIdx);
    if (d === 0)
      setSelected(i); // tapped the centered pack → select
    else setIndex(index + d); // bring a side pack to center
  };

  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* Focused-view control row (mirrors the reference opener) */}
      <div className="flex items-center justify-between px-5 pt-4 lg:px-8">
        <button
          type="button"
          aria-label="Back"
          onClick={() => history.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/15"
        >
          <ArrowLeftIcon />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Quick open"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/15"
          >
            <BoltIcon />
          </button>
          <button
            type="button"
            aria-label="Toggle sound"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/15"
          >
            <VolumeIcon />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
        {/* Accent glow behind the centered pack */}
        <div
          className="pointer-events-none absolute h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl transition-colors duration-500"
          style={{ backgroundColor: center.accent }}
        />

        <div className="relative h-[26rem] w-full max-w-md sm:h-[30rem]">
          {BRANCHES.map((b, i) => {
            const d = rel(i, centerIdx);
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => onPackClick(i)}
                aria-label={`${b.name} pack`}
                className="absolute left-1/2 top-1/2 -ml-[7.5rem] -mt-[11.25rem] h-[22.5rem] w-[15rem] transition-all duration-300 ease-out will-change-transform"
                style={slotStyle(d)}
              >
                <span
                  className={[
                    'block h-full w-full overflow-hidden rounded-2xl ring-1 ring-white/10',
                    d === 0 ? 'shadow-2xl' : '',
                    shuffling && d === 0 ? 'animate-pack-pop' : '',
                  ].join(' ')}
                >
                  <Image
                    src={b.packImage}
                    alt={`${b.name} booster pack`}
                    width={600}
                    height={900}
                    priority={i === 0}
                    className="h-full w-full object-cover"
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls + caption */}
      <div className="flex flex-col items-center gap-4 px-6 pb-10">
        <button
          type="button"
          onClick={shuffle}
          disabled={shuffling}
          className="flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-white/10 text-base font-bold uppercase tracking-wider text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 disabled:opacity-60"
        >
          <ShuffleIcon className="h-5 w-5" />
          {shuffling ? 'Shuffling…' : 'Shuffle'}
        </button>

        {selected === null ? (
          <p className="text-sm uppercase tracking-[0.2em] text-white/45">
            Tap to select a pack to open
          </p>
        ) : (
          <p className="text-center text-sm text-white/70">
            <span className="font-semibold text-white">{center.name}</span> selected · provably-fair
            opening arrives in Phase 6.
          </p>
        )}
      </div>
    </section>
  );
}
