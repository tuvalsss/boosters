// =============================================================================
// Placeholder asset generator (devnet / design-time only).
//
// Produces PNG placeholders for each "branch" (Pokémon, One Piece, Yu-Gi-Oh,
// NFL, NBA, TCG) so the UI has a tidy, predictable asset folder. REPLACE these
// with real artwork by dropping a PNG of the same name into the same folder.
//
// Pure Node (zlib only) — no native deps, so it runs anywhere and is
// re-runnable: `node scripts/generate-placeholder-assets.mjs`
//
// Layout produced under apps/web/public/assets/:
//   packs/<branch>.png   600x900  booster-pack placeholder (swirl + gloss)
//   cards/<branch>-1.png 500x700  graded-slab card placeholder
//   cards/<branch>-2.png 500x700  graded-slab card placeholder
// =============================================================================

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../apps/web/public/assets');

// ---- branches + brand palette (hex -> [r,g,b]) ------------------------------
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const BRANCHES = {
  pokemon: { a: hex('#2a75bb'), b: hex('#ffcb05'), name: 'Pokémon' },
  onepiece: { a: hex('#b3122a'), b: hex('#f3892b'), name: 'One Piece' },
  yugioh: { a: hex('#0b7a4b'), b: hex('#19e08a'), name: 'Yu-Gi-Oh' },
  nfl: { a: hex('#0b2545'), b: hex('#d7263d'), name: 'NFL' },
  nba: { a: hex('#1d1d1f'), b: hex('#e9772b'), name: 'NBA' },
  tcg: { a: hex('#3a2c66'), b: hex('#9b6dff'), name: 'TCG' },
};

// ---- PNG encoder (RGBA, 8-bit) ----------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // filter byte 0 per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- tiny drawing helpers ---------------------------------------------------
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function makeBuffer(w, h, fn) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * w + x) * 4;
      buf[i] = clamp(r);
      buf[i + 1] = clamp(g);
      buf[i + 2] = clamp(b);
      buf[i + 3] = clamp(a);
    }
  }
  return buf;
}

// Booster-pack placeholder: diagonal gradient + concentric swirl + gloss.
function packPixels(w, h, pal) {
  const cx = w * 0.5;
  const cy = h * 0.46;
  return makeBuffer(w, h, (x, y) => {
    const tg = (x / w + y / h) / 2; // diagonal gradient
    let c = mix(pal.a, pal.b, tg);
    // concentric rings (swirl)
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ring = 0.5 + 0.5 * Math.sin(dist / 26 + Math.atan2(dy, dx) * 2.5);
    c = mix(c, [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45], ring * 0.35);
    // diagonal gloss highlight
    const gloss = Math.max(0, 1 - Math.abs((x - y) / w - 0.15) * 6);
    c = mix(c, [255, 255, 255], gloss * 0.18);
    // bottom label band
    if (y > h * 0.86) c = mix(c, [10, 10, 12], 0.55);
    // crimp edges top/bottom
    if (y < h * 0.04 || y > h * 0.96) c = mix(c, [240, 240, 240], 0.5);
    return c;
  });
}

// Graded-slab card placeholder: gray slab frame + label + inner art gradient.
function cardPixels(w, h, pal, variant) {
  const border = Math.round(w * 0.06);
  const labelH = Math.round(h * 0.13);
  return makeBuffer(w, h, (x, y) => {
    // slab frame
    if (x < border || x > w - border || y < border || y > h - border) {
      const t = (x + y) / (w + h);
      return mix([214, 216, 220], [176, 180, 188], t);
    }
    // grading label band
    if (y < border + labelH) return [245, 246, 248];
    // inner art
    const ty = (y - border - labelH) / (h - border * 2 - labelH);
    const tx = x / w;
    let c = mix(pal.a, pal.b, (ty + tx) / 2 + (variant === 2 ? 0.15 : 0));
    const cx = w * 0.5;
    const cy = h * 0.6;
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    c = mix(c, [255, 255, 255], Math.max(0, 1 - d / (w * 0.7)) * 0.25);
    return c;
  });
}

// ---- generate ---------------------------------------------------------------
mkdirSync(resolve(OUT, 'packs'), { recursive: true });
mkdirSync(resolve(OUT, 'cards'), { recursive: true });

let count = 0;
for (const [key, pal] of Object.entries(BRANCHES)) {
  writeFileSync(resolve(OUT, `packs/${key}.png`), encodePNG(600, 900, packPixels(600, 900, pal)));
  writeFileSync(
    resolve(OUT, `cards/${key}-1.png`),
    encodePNG(500, 700, cardPixels(500, 700, pal, 1)),
  );
  writeFileSync(
    resolve(OUT, `cards/${key}-2.png`),
    encodePNG(500, 700, cardPixels(500, 700, pal, 2)),
  );
  count += 3;
}

console.log(`Generated ${count} placeholder PNGs under apps/web/public/assets/`);
