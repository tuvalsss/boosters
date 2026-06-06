import Link from 'next/link';

/** Boosters wordmark + geometric mark. */
export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-white" aria-label="Boosters home">
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        <span className="absolute left-0 top-0 h-3 w-3 rounded-[3px] bg-white" />
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-[3px] bg-white/60" />
        <span className="absolute bottom-0 left-0 h-3 w-3 rounded-[3px] bg-white/30" />
      </span>
      {!compact && <span className="text-xl font-extrabold tracking-tight">boosters</span>}
    </Link>
  );
}
