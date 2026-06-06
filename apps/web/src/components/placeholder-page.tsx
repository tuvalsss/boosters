import type { ComponentType, SVGProps } from 'react';

/** Simple "coming in a later phase" page for nav routes not yet built out. */
export function PlaceholderPage({
  title,
  phase,
  description,
  icon: Icon,
}: {
  title: string;
  phase: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 lg:px-8">
      <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/70">
          <Icon width={28} height={28} />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-md text-white/60">{description}</p>
        <span className="mt-6 rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-widest text-white/45">
          {phase}
        </span>
      </div>
    </div>
  );
}
