import { describe, expect, it } from 'vitest';
// @ts-expect-error plain script without types, also run by node in CI
import { checkSafetyGate } from '../scripts/safety-gate.mjs';

interface Result { errors: string[]; warnings: string[] }
const gate = (files: string[], title = 'fix: something', libraryChanged = false): Result =>
  checkSafetyGate({ files, title, libraryChanged });

describe('safety gate (a pull request that changes safety code)', () => {
  it('lets a change without safety code pass', () => {
    expect(gate(['src/ui/routes/list.ts', 'README.md'])).toEqual({ errors: [], warnings: [] });
  });

  it('fails a change to safety code without a changed test', () => {
    const r = gate(['src/core/safety/limit-settings.ts'], 'safety: lower the limit');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('src/core/safety/limit-settings.ts');
  });

  it('passes a change to safety code with a changed test and HARDWARE-TESTS.md', () => {
    const r = gate(['src/core/safety/limit-settings.ts', 'src/core/safety/limit-settings.test.ts', 'HARDWARE-TESTS.md'], 'safety(limit): x');
    expect(r).toEqual({ errors: [], warnings: [] });
  });

  it('warns when safety code changes under a title that is not safety', () => {
    const r = gate(['src/core/safety/quiet.ts', 'src/core/safety/quiet.test.ts', 'HARDWARE-TESTS.md'], 'refactor: rename');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some(w => w.includes('safety'))).toBe(true);
  });

  it('warns when a safety title comes without HARDWARE-TESTS.md', () => {
    const r = gate(['src/core/safety/quiet.ts', 'src/core/safety/quiet.test.ts'], 'safety: quieter');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some(w => w.includes('HARDWARE-TESTS.md'))).toBe(true);
  });

  it('counts the program runner, the hidden-tab pause, the wiring, the device chooser and the desktop app as safety code (#49 B, one list in scripts/paths.mjs)', () => {
    for (const f of ['src/core/training/program.ts', 'src/ui/background.ts', 'src/main.ts', 'electron/main.ts', 'electron/preload.ts', 'src/platform/bt-devices.ts', 'src/core/training/ramp.ts']) {
      expect(gate([f]).errors).toHaveLength(1);
    }
  });

  it('a test somewhere else does not count for safety code (#49 B)', () => {
    expect(gate(['src/core/safety/quiet.ts', 'src/core/routes/gpx.test.ts']).errors).toHaveLength(1);
    expect(gate(['src/main.ts', 'src/ui/routes/list.test.ts']).errors).toHaveLength(1);
  });

  it('a test next to safety code, or under tests/, counts', () => {
    expect(gate(['src/main.ts', 'tests/wiring.test.ts']).errors).toEqual([]);
    expect(gate(['src/core/training/program.ts', 'src/core/training/program.test.ts']).errors).toEqual([]);
    expect(gate(['src/ui/live/controls.ts', 'src/core/safety/stop-keys.test.ts']).errors).toEqual([]);
  });

  it('counts the live view and a new treadmill library as safety code', () => {
    expect(gate(['src/ui/live/controls.ts']).errors).toHaveLength(1);
    const bump = gate(['package.json', 'package-lock.json'], 'build(deps): ftms-treadmill 0.3.0', true);
    expect(bump.errors).toEqual([]);
    expect(bump.warnings.some(w => w.includes('ftms-treadmill'))).toBe(true);
    expect(gate(['package.json'], 'build(deps): vite 8')).toEqual({ errors: [], warnings: [] });
  });

  it('does not count a test file alone as safety code', () => {
    expect(gate(['src/core/safety/quiet.test.ts'])).toEqual({ errors: [], warnings: [] });
  });
});
