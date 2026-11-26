import { describe, expect, it } from 'vitest';
import { dialogStopShown, initialFocusIndex } from './dialog-stop';

describe('dialogStopShown', () => {
  it('shows while the belt runs or may run', () => {
    expect(dialogStopShown({ connected: true, maybeRunning: true, stopFailed: false })).toBe(true);
  });
  it('stays while a stop has failed, so that it can be tried again', () => {
    expect(dialogStopShown({ connected: true, maybeRunning: false, stopFailed: true })).toBe(true);
  });
  it('is hidden while the belt stands: there is nothing to stop', () => {
    expect(dialogStopShown({ connected: true, maybeRunning: false, stopFailed: false })).toBe(false);
  });
  it('is hidden without a connection', () => {
    expect(dialogStopShown({ connected: false, maybeRunning: false, stopFailed: false })).toBe(false);
    expect(dialogStopShown({ connected: false, maybeRunning: true, stopFailed: false })).toBe(false);
  });
});

describe('initialFocusIndex', () => {
  it('never starts on Stop: Enter or Space on opening must not stop the belt', () => {
    expect(initialFocusIndex([{ stop: true }, { stop: false }, { stop: false }])).toBe(1);
  });
  it('skips disabled controls', () => {
    expect(initialFocusIndex([{ stop: true }, { stop: false, disabled: true }, { stop: false }])).toBe(2);
  });
  it('skips hidden controls: focus() on them does nothing and would leave the focus on the Stop', () => {
    expect(initialFocusIndex([{ stop: true }, { stop: false, hidden: true }, { stop: false }])).toBe(2);
    expect(initialFocusIndex([{ stop: false, hidden: true }, { stop: true }])).toBe(1);
  });
  it('falls back to the Stop when it is the only control', () => {
    expect(initialFocusIndex([{ stop: true }])).toBe(0);
  });
  it('is -1 when nothing can take focus', () => {
    expect(initialFocusIndex([])).toBe(-1);
    expect(initialFocusIndex([{ stop: false, disabled: true }])).toBe(-1);
  });
});
