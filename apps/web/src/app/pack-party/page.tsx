import Image from 'next/image';
import Link from 'next/link';
import { BRANCHES } from '@/lib/branches';
import { PartyIcon } from '@/components/icons';

export const metadata = { title: 'Pack Party · Boosters' };

const ROOMS = [
  { name: 'Saturday Grails', viewers: 128, status: 'Live', branch: 'creature' },
  { name: 'Gold Chase', viewers: 84, status: 'Opening', branch: 'legend' },
  { name: 'Rookie Vault', viewers: 57, status: 'Queued', branch: 'sports' },
];

export default function PackPartyPage() {
  const featured = BRANCHES.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-60 lg:block">
          {featured.map((branch, index) => (
            <Image
              key={branch.key}
              src={branch.packImage}
              alt=""
              width={600}
              height={900}
              className="absolute top-1/2 h-72 w-auto rounded-xl shadow-2xl ring-1 ring-white/10"
              style={{
                right: `${index * 4 + 6}rem`,
                transform: `translateY(-50%) rotate(${index * 9 - 14}deg)`,
                zIndex: featured.length - index,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-xl">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black">
            <PartyIcon />
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pack Party</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Shared pack rooms for live openings, raffle countdowns, and collector chat around
            vaulted inventory.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/packs"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Choose a Pack
            </Link>
            <Link
              href="/activity"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.07]"
            >
              View Activity
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {ROOMS.map((room) => {
          const branch = BRANCHES.find((item) => item.key === room.branch)!;
          return (
            <Link
              key={room.name}
              href="/packs"
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20"
            >
              <div className="relative h-44 bg-black/30">
                <Image
                  src={branch.packImage}
                  alt={`${branch.name} pack`}
                  fill
                  className="object-contain p-5 transition group-hover:-translate-y-1"
                />
                <span className="absolute left-3 top-3 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-black">
                  {room.status}
                </span>
              </div>
              <div className="p-4">
                <p className="font-semibold">{room.name}</p>
                <p className="mt-1 text-xs text-white/45">
                  {room.viewers} collectors / {branch.name}
                </p>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
