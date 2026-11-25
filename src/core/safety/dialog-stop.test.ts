import { describe, expect, it } from 'vitest';
import { dialogStopShown, initialFocusIndex } from './dialog-stop';

describe('dialogStopShown', () => {
  it('shows whenever the treadmill is connected, also when the belt is not reported as running', () => {
    expect(dialogStopShown({ connected: true, maybeRunning: false })).toBe(true);
    expect(dialogStopShown({ connected: true, maybeRunning: true })).toBe(true);
  });
  it('is hidden without a connection', () => {
    expect(dialogStopShown({ connected: false, maybeRunning: false })).toBe(false);
    expect(dialogStopShown({ connected: false, maybeRunning: true })).toBe(false);
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
