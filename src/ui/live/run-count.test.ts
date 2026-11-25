import { describe, expect, it, vi } from 'vitest';
import { createRunCounter, startFree } from './run-count';

describe('startFree', () => {
  it('counts run.free once after a successful start', async () => {
    const count = vi.fn();
    await startFree(() => Promise.resolve(true), count);
    expect(count.mock.calls).toEqual([['run.free']]);
  });

  it('counts nothing when the start reports failure or rejects', async () => {
    const count = vi.fn();
    await startFree(() => Promise.resolve(false), count);
    await expect(startFree(() => Promise.reject(new Error('x')), count)).rejects.toThrow('x');
    expect(count).not.toHaveBeenCalled();
  });

  it('gives the same result when count throws', async () => {
    const count = vi.fn(() => { throw new Error('boom'); });
    await expect(startFree(() => Promise.resolve(true), count)).resolves.toBeUndefined();
  });
});

describe('createRunCounter', () => {
  it('counts once when the run reaches the countdown, not in starting, not twice', () => {
    const count = vi.fn();
    const observe = createRunCounter(count);
    const run = { kind: 'workout' };
    observe(null, 'idle');
    observe(run, 'starting');
    expect(count).not.toHaveBeenCalled();
    observe(run, 'countdown');
    observe(run, 'running');
    observe(run, 'countdown');
    expect(count.mock.calls).toEqual([['run.workout']]);
  });

  it('counts nothing when the start fails (the run ends in starting)', () => {
    const count = vi.fn();
    const observe = createRunCounter(count);
    observe({ kind: 'route' }, 'starting');
    observe(null, 'idle');
    expect(count).not.toHaveBeenCalled();
  });

  it('counts a new run again, by kind', () => {
    const count = vi.fn();
    const observe = createRunCounter(count);
    observe({ kind: 'route' }, 'running');
    observe({ kind: 'route' }, 'running');
    expect(count.mock.calls).toEqual([['run.route'], ['run.route']]);
  });

  it('does not break when count throws', () => {
    const observe = createRunCounter(() => { throw new Error('boom'); });
    expect(() => observe({ kind: 'workout' }, 'countdown')).not.toThrow();
  });
});
