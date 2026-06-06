import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Phase-1 smoke: the shell advertises devnet/sandbox and never uses
// gambling/"guaranteed" language in default copy (spec §9).
describe('web shell copy', () => {
  const page = readFileSync(resolve(__dirname, '../src/app/page.tsx'), 'utf8');

  it('declares test mode', () => {
    expect(page.toLowerCase()).toContain('devnet');
    expect(page.toLowerCase()).toContain('no real funds');
  });

  it('avoids prohibited "guaranteed" language', () => {
    expect(page.toLowerCase()).not.toContain('guaranteed');
  });
});
