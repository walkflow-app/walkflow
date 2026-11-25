// The Target figure in the training view shows the speed the next Start will ramp to, never the slider's position.
// ftms-treadmill ramps at Start to `governor.target ?? wanted`; `wanted` is the last non-null target and is cleared only by
// a disconnect. The figure follows the same rule, with the last target kept here.

import { describe, expect, it } from 'vitest';
import { afterTarget, NO_TARGET_TEXT, shownTarget, targetFigureText, type TargetMemory } from './target-figure';

const fmt = (kmh: number) => `${kmh.toFixed(1)} km/h`;

describe('targetFigureText', () => {
  it('shows the target when one is set', () => {
    expect(targetFigureText(4.5, fmt)).toBe('4.5 km/h');
  });

  it('shows a dash, not the slider value, while nothing is set', () => {
    expect(targetFigureText(null, fmt)).toBe(NO_TARGET_TEXT);
    expect(NO_TARGET_TEXT).toBe('–');
  });

  it('does not treat a target of 0 as no target', () => {
    expect(targetFigureText(0, fmt)).toBe('0.0 km/h');
  });
});

describe('the speed the figure shows (target, last target)', () => {
  const fresh: TargetMemory = null;
  const range = { min: 1, max: 6 };

  it('a new connection gives a dash', () => {
    expect(shownTarget(null, fresh, range)).toBeNull();
  });

  it('a target shows, and is remembered', () => {
    expect(shownTarget(4, fresh, range)).toBe(4);
    expect(afterTarget(fresh, 4)).toBe(4);
  });

  it('a Stop on the same connection (target null) still shows the speed Start will ramp to', () => {
    const last = afterTarget(afterTarget(fresh, 4), null);
    expect(last).toBe(4);
    expect(shownTarget(null, last, range)).toBe(4);
  });

  it('a newer target replaces the remembered one', () => {
    expect(afterTarget(afterTarget(fresh, 4), 5.5)).toBe(5.5);
  });

  it('a target of 0 is remembered like any other', () => {
    expect(shownTarget(null, afterTarget(fresh, 0), { min: 0, max: 6 })).toBe(0);
  });

  it('a disconnect clears it: the next connection gives a dash', () => {
    const last = afterTarget(fresh, 4);
    expect(shownTarget(null, afterTarget(last, null, true), range)).toBeNull();
  });

  it('a Stop at 7, then the limit lowered to 5: the figure shows 5, as Start will ramp', () => {
    expect(shownTarget(null, 7, { min: 1, max: 5 })).toBe(5);
  });

  it('a limit below the device minimum: Start ramps to nothing, so a dash', () => {
    expect(shownTarget(null, 4, { min: 2, max: 1.5 })).toBeNull();
  });
});
