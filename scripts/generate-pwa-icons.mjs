import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(process.cwd(), 'apps', 'web', 'public', 'icons');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function roundedSquare(x, y, left, top, size, radius) {
  const right = left + size;
  const bottom = top + size;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return x >= left && x <= right && y >= top && y <= bottom && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function makeIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const bgA = [76, 29, 149];
  const bgB = [7, 7, 10];
  const emerald = [16, 185, 129];
  const mark = size * 0.18;
  const gap = size * 0.055;
  const radius = size * 0.045;
  const startX = size * 0.31;
  const startY = size * 0.29;
  const squares = [
    [startX, startY, [255, 255, 255], 1],
    [startX + mark + gap, startY + mark + gap, [255, 255, 255], 0.66],
    [startX, startY + mark + gap, [255, 255, 255], 0.32],
  ];

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    pixels[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const ny = y / (size - 1);
      const glow = Math.max(0, 1 - Math.hypot(nx - 0.28, ny - 0.24) * 1.6);
      const t = Math.min(1, ny * 0.8 + nx * 0.25);
      let r = mix(bgA[0], bgB[0], t);
      let g = mix(bgA[1], bgB[1], t);
      let b = mix(bgA[2], bgB[2], t);
      r = mix(r, emerald[0], glow * 0.18);
      g = mix(g, emerald[1], glow * 0.18);
      b = mix(b, emerald[2], glow * 0.18);

      for (const [left, top, color, alpha] of squares) {
        if (roundedSquare(x, y, left, top, mark, radius)) {
          r = mix(r, color[0], alpha);
          g = mix(g, color[1], alpha);
          b = mix(b, color[2], alpha);
        }
      }

      const i = rowStart + 1 + x * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, makeIcon(size));
  console.log(`Generated ${file}`);
}
