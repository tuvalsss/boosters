import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'apps/web/public/assets/brand-packs');
mkdirSync(outDir, { recursive: true });

const packs = [
  {
    key: 'creature',
    title: 'CREATURE TCG',
    subtitle: 'FANTASY TCG',
    main: '#0068e8',
    dark: '#00122f',
    light: '#22a8ff',
    icon: 'creature',
  },
  {
    key: 'adventure',
    title: 'ADVENTURE TCG',
    subtitle: 'QUEST & EXPLORE',
    main: '#5b8b24',
    dark: '#10230a',
    light: '#c5e86e',
    icon: 'compass',
  },
  {
    key: 'arcana',
    title: 'ARCANA DUEL',
    subtitle: 'MAGIC TCG',
    main: '#6d16dc',
    dark: '#160027',
    light: '#c57bff',
    icon: 'arcana',
  },
  {
    key: 'sports',
    title: 'SPORTS ICONS',
    subtitle: 'SPORTS TCG',
    main: '#e13020',
    dark: '#2e0400',
    light: '#ff8a63',
    icon: 'ball',
  },
  {
    key: 'rookie',
    title: 'ROOKIE CORE',
    subtitle: 'ESSENTIAL TCG',
    main: '#00a8b5',
    dark: '#01242d',
    light: '#66f4ff',
    icon: 'star',
  },
  {
    key: 'legend',
    title: 'VAULT LEGENDS',
    subtitle: 'PREMIUM TCG',
    main: '#d89a00',
    dark: '#271600',
    light: '#ffe36b',
    icon: 'shield',
  },
];

for (const pack of packs) {
  for (const state of ['front', 'back', 'opened']) {
    writeFileSync(join(outDir, `${pack.key}-${state}.svg`), renderPack(pack, state), 'utf8');
  }
}

function renderPack(pack, state) {
  const opened = state === 'opened';
  const back = state === 'back';
  const titleY = back ? 546 : 612;
  const iconY = back ? 410 : 360;
  const iconScale = back ? 0.56 : 1;
  const title = escapeSvgText(pack.title);
  const subtitle = escapeSvgText(pack.subtitle);

  return `<svg width="600" height="900" viewBox="0 0 600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body" x1="78" y1="44" x2="520" y2="855" gradientUnits="userSpaceOnUse">
      <stop stop-color="${pack.light}"/>
      <stop offset="0.18" stop-color="${pack.main}"/>
      <stop offset="0.72" stop-color="${pack.dark}"/>
      <stop offset="1" stop-color="#050507"/>
    </linearGradient>
    <linearGradient id="side" x1="72" y1="70" x2="520" y2="830" gradientUnits="userSpaceOnUse">
      <stop stop-color="white" stop-opacity=".58"/>
      <stop offset=".2" stop-color="white" stop-opacity=".04"/>
      <stop offset=".5" stop-color="#000" stop-opacity=".24"/>
      <stop offset=".82" stop-color="white" stop-opacity=".2"/>
      <stop offset="1" stop-color="#000" stop-opacity=".45"/>
    </linearGradient>
    <linearGradient id="foil" x1="88" y1="74" x2="520" y2="836" gradientUnits="userSpaceOnUse">
      <stop stop-color="white" stop-opacity=".65"/>
      <stop offset=".2" stop-color="white" stop-opacity="0"/>
      <stop offset=".43" stop-color="white" stop-opacity=".28"/>
      <stop offset=".58" stop-color="white" stop-opacity="0"/>
      <stop offset=".8" stop-color="white" stop-opacity=".18"/>
      <stop offset="1" stop-color="#000" stop-opacity=".2"/>
    </linearGradient>
    <linearGradient id="silver" x1="118" y1="110" x2="520" y2="240" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f7f7f7"/>
      <stop offset=".16" stop-color="#8d8d8d"/>
      <stop offset=".32" stop-color="#ffffff"/>
      <stop offset=".5" stop-color="#b8b8b8"/>
      <stop offset=".72" stop-color="#f9f9f9"/>
      <stop offset="1" stop-color="#777"/>
    </linearGradient>
    <pattern id="motif" width="82" height="82" patternUnits="userSpaceOnUse">
      <circle cx="40" cy="42" r="17" stroke="white" stroke-opacity=".13" stroke-width="4"/>
      <path d="M22 42H58M40 24V60" stroke="black" stroke-opacity=".14" stroke-width="4"/>
      <path d="M66 18l8 12 14 3-10 10 1 14-13-6-13 6 2-14-10-10 14-3z" fill="white" fill-opacity=".08"/>
    </pattern>
    <filter id="shadow" x="30" y="30" width="540" height="850" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity=".55"/>
    </filter>
  </defs>

  <rect width="600" height="900" fill="none"/>
  <g filter="url(#shadow)">
    ${opened ? openedTop() : ''}
    <path d="M95 76H505L526 116V790L505 826H95L74 790V116L95 76Z" fill="url(#body)"/>
    <path d="M106 100H494L506 126V776L494 802H106L94 776V126L106 100Z" fill="url(#motif)" opacity=".78"/>
    <path d="M95 76H505L526 116V790L505 826H95L74 790V116L95 76Z" fill="url(#side)" style="mix-blend-mode:screen" opacity=".78"/>
    <path d="M126 116H474L488 142V760L474 786H126L112 760V142L126 116Z" stroke="white" stroke-opacity=".22" stroke-width="4"/>
    ${crimps()}
    ${sideSeams()}
    ${back ? centerSeam() : ''}
    <g transform="translate(300 ${iconY}) scale(${iconScale})">${icon(pack.icon)}</g>
    ${back ? barcode() : ''}
    <text x="300" y="${titleY}" text-anchor="middle" fill="white" font-family="Inter, Arial, sans-serif" font-size="${back ? 38 : 44}" font-weight="900">${title}</text>
    <text x="300" y="${titleY + 46}" text-anchor="middle" fill="white" fill-opacity=".88" font-family="Inter, Arial, sans-serif" font-size="${back ? 24 : 27}" font-weight="800">${subtitle}</text>
    <path d="M128 700H472" stroke="white" stroke-opacity=".2" stroke-width="4"/>
    <path d="M88 80C164 106 232 112 300 106C376 99 446 102 512 78" stroke="white" stroke-opacity=".22" stroke-width="5"/>
    <path d="M82 820C164 796 235 790 302 796C376 802 446 800 516 822" stroke="white" stroke-opacity=".18" stroke-width="5"/>
    <path d="M118 116C188 136 262 142 338 136C392 132 440 126 486 110" stroke="white" stroke-opacity=".24" stroke-width="18" style="mix-blend-mode:screen"/>
    <path d="M82 76H518V826H82Z" fill="url(#foil)" style="mix-blend-mode:screen" opacity=".86"/>
  </g>
</svg>`;
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function crimps() {
  return `<g opacity=".95">
    <path d="M82 78H518V102H82Z" fill="#050505" fill-opacity=".25"/>
    <path d="M82 800H518V824H82Z" fill="#050505" fill-opacity=".28"/>
    ${zig(82, 104)}
    ${zig(82, 798)}
    ${Array.from({ length: 10 }, (_, i) => {
      const y = 88 + i * 4;
      return `<path d="M92 ${y}H508" stroke="white" stroke-opacity="${i < 4 ? '.42' : '.14'}" stroke-width="2"/>`;
    }).join('')}
    ${Array.from({ length: 10 }, (_, i) => {
      const y = 804 + i * 4;
      return `<path d="M92 ${y}H508" stroke="black" stroke-opacity="${i < 4 ? '.36' : '.14'}" stroke-width="2"/>`;
    }).join('')}
  </g>`;
}

function zig(x, y) {
  const points = [];
  for (let i = 0; i <= 44; i++) points.push(`${x + i * 10},${y + (i % 2 ? 8 : 0)}`);
  return `<polyline points="${points.join(' ')}" stroke="white" stroke-opacity=".5" stroke-width="4" fill="none"/>`;
}

function sideSeams() {
  return `<g opacity=".72">
    <path d="M96 116V786" stroke="white" stroke-opacity=".18" stroke-width="5"/>
    <path d="M114 128V774" stroke="black" stroke-opacity=".28" stroke-width="4"/>
    <path d="M504 116V786" stroke="white" stroke-opacity=".22" stroke-width="5"/>
    <path d="M486 128V774" stroke="black" stroke-opacity=".32" stroke-width="4"/>
  </g>`;
}

function centerSeam() {
  return `<g opacity=".42">
    <path d="M300 92V798" stroke="white" stroke-width="3"/>
    <path d="M315 96V794" stroke="black" stroke-opacity=".36" stroke-width="4"/>
    <path d="M282 96V794" stroke="white" stroke-opacity=".18" stroke-width="4"/>
    <path d="M258 98V790" stroke="white" stroke-opacity=".15" stroke-width="3"/>
    <path d="M342 98V790" stroke="black" stroke-opacity=".2" stroke-width="3"/>
  </g>`;
}

function barcode() {
  return `<g transform="translate(218 678)">
    <rect width="164" height="52" fill="#e5e5e5"/>
    ${Array.from({ length: 28 }, (_, i) => {
      const w = [2, 4, 1, 6, 3][i % 5];
      const x = 8 + i * 5;
      return `<rect x="${x}" y="6" width="${w}" height="34" fill="#111"/>`;
    }).join('')}
    <text x="82" y="49" text-anchor="middle" font-family="monospace" font-size="11" fill="#111">6 771860 01362 8</text>
  </g>`;
}

function openedTop() {
  return `<g transform="translate(92 74)">
    <path d="M20 64C82 26 146 18 226 54C292 83 348 54 414 18L430 120C336 158 286 154 218 132C128 104 72 118 12 154Z" fill="url(#silver)"/>
    <path d="M20 64C82 26 146 18 226 54C292 83 348 54 414 18" stroke="white" stroke-width="12" stroke-opacity=".75"/>
    <path d="M36 94C120 76 176 96 232 110C300 128 350 122 416 92" stroke="#666" stroke-opacity=".5" stroke-width="8"/>
    <path d="M118 30C130 70 140 98 150 132M214 52C224 84 232 108 240 138M314 48C306 86 300 112 292 144M382 34C368 78 358 108 344 138" stroke="white" stroke-opacity=".4" stroke-width="5"/>
  </g>`;
}

function icon(kind) {
  if (kind === 'creature') {
    return `<path d="M0-108C64-42 92 4 92 55C92 111 52 152 0 152C-52 152-92 111-92 55C-92 4-64-42 0-108Z" fill="#d6eeff"/>
    <path d="M0-72C42-28 60 6 60 46C60 84 34 112 0 112C-34 112-60 84-60 46C-60 6-42-28 0-72Z" fill="#64b6ff"/>
    <circle cx="-32" cy="42" r="13" fill="#10151f"/>
    <circle cx="32" cy="42" r="13" fill="#10151f"/>
    <path d="M-34 82C-10 105 14 105 38 82" stroke="#10151f" stroke-width="13" stroke-linecap="round"/>`;
  }
  if (kind === 'compass') {
    return `<circle r="104" fill="white" fill-opacity=".12"/><circle r="82" stroke="#f5ffd0" stroke-width="7"/>
    <path d="M0-122L27-28L120 0L27 28L0 122L-27 28L-120 0L-27-28Z" fill="#f7f3cf"/>
    <path d="M0-122L27-28L0 0L-27-28Z" fill="#b28432"/><path d="M0 122L27 28L0 0L-27 28Z" fill="#fff8ca"/>
    <circle r="18" fill="#24400f"/>`;
  }
  if (kind === 'arcana') {
    return `<path d="M0-126L32-34L122-84L70 6L120 92L30 44L0 130L-30 44L-120 92L-70 6L-122-84L-32-34Z" fill="#eee6ff"/>
    <path d="M0-126L0 130L30 44L120 92L70 6L122-84L32-34Z" fill="#c3a4ff"/><circle r="20" fill="#7c3aed"/>`;
  }
  if (kind === 'ball') {
    return `<circle r="102" fill="#f8f8f8"/><circle r="102" stroke="#222" stroke-width="8"/><path d="M0-42L42-12L26 38H-26L-42-12Z" fill="#cc1f18" stroke="#222" stroke-width="5"/>
    <path d="M-42-12L-92-36M42-12L92-36M26 38L58 86M-26 38L-58 86M0-42V-96" stroke="#222" stroke-width="7"/><path d="M-76-68C-34-102 34-102 76-68M-86 58C-48 106 48 106 86 58" stroke="#cc1f18" stroke-width="12" stroke-linecap="round"/>`;
  }
  if (kind === 'star') {
    return `<path d="M0-124L34-38L126-32L56 25L78 116L0 68L-78 116L-56 25L-126-32L-34-38Z" fill="#f5f7fb"/>
    <path d="M0-124V68L78 116L56 25L126-32L34-38Z" fill="#cfd8df"/>`;
  }
  return `<path d="M0-120L96-82V12C96 78 52 124 0 150C-52 124-96 78-96 12V-82Z" fill="#2b1d00" stroke="#ffe36b" stroke-width="13"/>
  <path d="M0-70L24-16L82-10L38 28L50 86L0 56L-50 86L-38 28L-82-10L-24-16Z" fill="#ffd43b"/>`;
}
