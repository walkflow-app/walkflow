// The Target figure (src/ui/live/target-figure.ts) shows a dash only when Start will not ramp. That rests on two rules of the
// pinned ftms-treadmill; if a library version changes them, this fails and the figure must be rethought before the bump.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('a dash means Start will not ramp (the library rule the figure relies on)', () => {
  const dist = join(process.cwd(), 'node_modules/ftms-treadmill/dist/device');
  const read = (f: string) => readFileSync(join(dist, f), 'utf8');

  it('Start ramps to governor.target ?? wanted', () => {
    expect(read('belt-commands.js')).toContain('const chosen = governor.target ?? host.wanted();');
  });

  it('wanted keeps the last non-null target and is cleared only on a disconnect', () => {
    const src = read('treadmill.js');
    expect(src).toMatch(/if \(governor\.target !== null\)\s*wanted = governor\.target;/);
    expect(src.match(/wanted = null;/g)).toHaveLength(2) // the initial value and onDisconnected;
    expect(src.slice(src.indexOf('function onDisconnected'))).toContain('wanted = null;');
  });
});
