import Link from 'next/link';
import type { Branch } from '@/lib/branches';
import { PackArt } from './pack-art';

/** Open-Packs grid tile. Prize cards render only from real vault/eBay photos elsewhere. */
export function PackTile({ branch }: { branch: Branch }) {
  return (
    <Link
      href="/packs"
      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="relative mx-auto flex h-56 items-end justify-center">
        <span
          aria-hidden
          className="absolute bottom-10 h-40 w-40 rounded-full opacity-45 blur-3xl transition group-hover:scale-[1.08]"
          style={{ backgroundColor: branch.accent }}
        />
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
