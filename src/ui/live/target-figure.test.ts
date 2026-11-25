// The Target figure in the training view shows the speed the next Start will ramp to, never the slider's position.
// ftms-treadmill ramps at Start to `governor.target ?? wanted`; `wanted` is the last non-null target and is cleared only by
// a disconnect. The figure follows the same rule, with the last target kept here.

import { describe, expect, it } from 'vitest';
import { afterTarget, clampLikeStart, NO_TARGET_TEXT, shownTarget, targetFigureText, type TargetMemory } from './target-figure';

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

  it('a bound that is not a multiple of 0.1 is rounded inside it, as Start ramps (5.55 → 5.5, 1.05 → 1.1)', () => {
    expect(shownTarget(null, 7, { min: 1, max: 5.55 })).toBe(5.5);
    expect(shownTarget(null, 0.5, { min: 1.05, max: 6 })).toBe(1.1);
    expect(shownTarget(null, 4.04, range)).toBe(4);
  });
});

describe('the clamp the figure uses matches the library clamp at Start (clampSpeed)', () => {
  it('rounds to 0.1 without leaving the range, and gives null when no value is allowed', () => {
    expect(clampLikeStart(7, { min: 1, max: 5.55 })).toBe(5.5);
    expect(clampLikeStart(0.5, { min: 1.05, max: 6 })).toBe(1.1);
    expect(clampLikeStart(3.26, { min: 1, max: 6 })).toBe(3.3);
    expect(clampLikeStart(3, { min: 1.01, max: 1.09 })).toBeNull();
    expect(clampLikeStart(Number.NaN, { min: 1, max: 6 })).toBeNull();
  });
});

describe('the remembered target follows only the targets asked for (the library `wanted`)', () => {
  // A limit lowered while the belt stands clamps the governor's target without a 'target' event; the library keeps `wanted`
  // at the speed asked for. The memory is taken only from 'target' events, so it keeps that speed too.
  it('target 6 held, limit lowered to 4, Stop, limit raised to 6 again: the figure shows 6, as Start ramps', () => {
    let last: TargetMemory = afterTarget(null, 6); // 'target' event: 6 asked for while the belt stands
    // limit lowered to 4: tm.state.target is 4 now, but no 'target' event, so the memory is not touched
    expect(shownTarget(4, last, { min: 1, max: 4 })).toBe(4);
    last = afterTarget(last, null); // Stop: 'target' event, target null
    expect(shownTarget(null, last, { min: 1, max: 4 })).toBe(4);
    expect(shownTarget(null, last, { min: 1, max: 6 })).toBe(6); // limit raised: Start ramps to wanted = 6
  });
});
