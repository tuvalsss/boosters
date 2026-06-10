import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BRANCHES, branchByKey, type BranchKey } from '@/lib/branches';
import { ArrowRightIcon } from '@/components/icons';
import { PackArt } from '@/components/pack-art';

export function generateStaticParams() {
  return BRANCHES.map((b) => ({ key: b.key }));
}

export function generateMetadata({ params }: { params: { key: string } }) {
  const valid = BRANCHES.some((b) => b.key === params.key);
  return { title: valid ? `${branchByKey(params.key as BranchKey).name} · Boosters` : 'Boosters' };
}

export default function BranchPage({ params }: { params: { key: string } }) {
  if (!BRANCHES.some((b) => b.key === params.key)) notFound();
  const branch = branchByKey(params.key as BranchKey);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-10 lg:px-10"
        style={{
          background: `linear-gradient(135deg, ${branch.accent}22, transparent 60%)`,
        }}
      >
        <div className="grid items-center gap-8 sm:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">{branch.name}</h1>
            <p className="mt-3 max-w-sm text-white/65">{branch.tagline}</p>
            <Link
              href="/packs"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
            >
              Open {branch.name} packs <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex justify-center">
            <PackArt
              src={branch.packImage}
              alt={`${branch.name} pack`}
              className="h-64"
              imageClassName="drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-bold">Live inventory</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          Pull images come only from vaulted card photos and imported eBay listing images. This
          branch no longer displays generated card art as recent pulls.
        </p>
        <Link
          href="/demo"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/5"
        >
          Try live eBay demo <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
