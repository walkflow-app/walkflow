// docs/USAGE.md lists exactly the fixed names and patterns that the code can build (src/core/usage/events.ts), nothing more and
// nothing less. The error task extends this to src/core/usage/errors.ts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIXED_NAMES, PATTERNS } from '../src/core/usage/events';

const doc = readFileSync(fileURLToPath(new URL('../docs/USAGE.md', import.meta.url)), 'utf8');

/** The list under "## Names": one bullet with the name in backticks per line */
const listed = (() => {
  const section = /^## Names\n([\s\S]*?)(?=^## )/m.exec(doc)?.[1] ?? '';
  return [...section.matchAll(/^- `([^`]+)`$/gm)].map(m => m[1]!);
})();

describe('docs/USAGE.md', () => {
  it('lists every fixed name and pattern of events.ts', () => {
    const missing = [...FIXED_NAMES, ...PATTERNS].filter(n => !listed.includes(n));
    expect(missing).toEqual([]);
  });

  it('lists nothing that events.ts does not export', () => {
    const extra = listed.filter(n => !FIXED_NAMES.includes(n) && !PATTERNS.includes(n));
    expect(extra).toEqual([]);
  });

  it('lists each name once', () => {
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.length).toBeGreaterThan(0);
  });
});
