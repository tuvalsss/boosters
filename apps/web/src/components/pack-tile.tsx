import Image from 'next/image';
import Link from 'next/link';
import type { Branch } from '@/lib/branches';
import { PackArt } from './pack-art';

/** Open-Packs grid tile: a graded card peeking out behind a booster pack. */
export function PackTile({ branch }: { branch: Branch }) {
  return (
    <Link
      href="/packs"
      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="relative mx-auto flex h-56 items-end justify-center">
        {/* card peeking behind */}
        <Image
          src={branch.cardImages[0]}
          alt=""
          width={500}
          height={700}
          className="absolute bottom-6 h-44 w-auto -rotate-6 rounded-lg opacity-90 shadow-lg transition group-hover:-translate-y-2"
        />
        {/* pack in front */}
        <PackArt
          src={branch.packImage}
          alt={`${branch.name} pack`}
          className="relative h-52 transition group-hover:-translate-y-1"
        />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{branch.name}</p>
          <p className="text-xs text-white/50">Graded · vaulted 1:1</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
          ${branch.priceUsdc}
        </span>
      </div>
    </Link>
  );
}
