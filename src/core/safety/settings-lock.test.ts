import { describe, expect, it } from 'vitest';
import { lockStep, safetySettingsEditable, settingsLocked } from './settings-lock';

const standing = { connected: true, maybeRunning: false };
const running = { connected: true, maybeRunning: true };
const offline = { connected: false, maybeRunning: false };

describe('the settings lock (#45)', () => {
  it('is locked while connected and the belt may run', () => {
    expect(settingsLocked(running)).toBe(true);
    expect(settingsLocked(standing)).toBe(false);
    expect(settingsLocked(offline)).toBe(false);
  });

  it('closes an open dialog on every check while locked, also when the belt was started on the treadmill', () => {
    expect(lockStep(true, true)).toEqual({ locked: true, close: true });
    expect(lockStep(true, false)).toEqual({ locked: true, close: false });
  });

  it('closes nothing when unlocked', () => {
    expect(lockStep(false, true)).toEqual({ locked: false, close: false });
    expect(lockStep(false, false)).toEqual({ locked: false, close: false });
  });

  it('refuses a change to the limit or the step while the belt may run (a field that fires as the dialog closes)', () => {
    expect(safetySettingsEditable(running)).toBe(false);
    expect(safetySettingsEditable(standing)).toBe(true);
    expect(safetySettingsEditable(offline)).toBe(true);
  });
});
