// The Target figure (src/ui/live/target-figure.ts) shows a dash only when Start will not ramp. That rests on three rules of the
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
    expect(src.match(/wanted = null;/g)).toHaveLength(2); // the initial value and onDisconnected
    expect(src.slice(src.indexOf('function onDisconnected'))).toContain('wanted = null;');
  });

  it('wanted changes only where a target event follows, and a limit change clamps the target without that event', () => {
    // The app takes its memory from 'target' events only (speed-controls.ts); that matches `wanted` only while these hold
    const src = read('treadmill.js');
    expect(src.match(/\bwanted = /g)).toHaveLength(3); // initial, onChange, onDisconnected
    expect(src).toMatch(/if \(governor\.target !== null\)\s*wanted = governor\.target;\s*emit\('target', undefined\);/);
    const safety = readFileSync(join(process.cwd(), 'node_modules/ftms-treadmill/dist/safety/safety.js'), 'utf8');
    const setRange = safety.slice(safety.indexOf('setRange(range) {'), safety.indexOf('request(kmh) {'));
    expect(setRange).toContain('this._target = clampSpeed(this._target, range);');
    expect(setRange).not.toContain('onChange');
  });

  it('the clamp at Start rounds to 0.1 inside the range (target-figure.ts clampLikeStart mirrors it)', () => {
    const safety = readFileSync(join(process.cwd(), 'node_modules/ftms-treadmill/dist/safety/safety.js'), 'utf8');
    expect(safety).toContain('let v = Math.round(Math.max(range.min, Math.min(range.max, kmh)) * 10) / 10;');
    expect(safety).toContain('v = floor01(range.max);');
    expect(safety).toContain('v = ceil01(range.min);');
  });

  it('the speed Start asks for is clamped to the range (governor.request uses clampSpeed)', () => {
    expect(read('belt-commands.js')).toContain('governor.request(chosen);');
    const safety = readFileSync(join(process.cwd(), 'node_modules/ftms-treadmill/dist/safety/safety.js'), 'utf8');
    expect(safety).toMatch(/request\(kmh\) \{\s*const clamped = clampSpeed\(kmh, this\.range\);/);
  });
});
