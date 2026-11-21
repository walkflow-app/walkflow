import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

describe('throttle (#49 G: a peer cannot keep the main thread busy with offer updates)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs at once, then at most once per interval, and once more at the end', () => {
    const fn = vi.fn();
    const t = throttle(fn, 500);
    t();
    expect(fn).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 100; i++) t();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('a call after a quiet time runs at once', () => {
    const fn = vi.fn();
    const t = throttle(fn, 500);
    t();
    vi.advanceTimersByTime(1000);
    t();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
