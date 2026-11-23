// The Target figure in the training view shows the speed the treadmill was asked for, never the slider's position.

import { describe, expect, it } from 'vitest';
import { NO_TARGET_TEXT, targetFigureText } from './target-figure';

const fmt = (kmh: number) => `${kmh.toFixed(1)} km/h`;

describe('targetFigureText', () => {
  it('shows the target when one is set', () => {
    expect(targetFigureText(4.5, fmt)).toBe('4.5 km/h');
  });

  it('shows a dash, not the slider value, while no target is set (first connection, after a reconnect)', () => {
    expect(targetFigureText(null, fmt)).toBe(NO_TARGET_TEXT);
    expect(NO_TARGET_TEXT).toBe('–');
  });

  it('does not treat a target of 0 as no target', () => {
    expect(targetFigureText(0, fmt)).toBe('0.0 km/h');
  });
});
