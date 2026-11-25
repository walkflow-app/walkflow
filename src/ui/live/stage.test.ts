import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgramRunner, type ProgramStep } from '../../core/training/program';
import { setupStage, type StageHost } from './stage';

// No DOM in the tests: every element the stage writes to is a plain object
function stubDocument() {
  const elements = new Map<string, object>();
  vi.stubGlobal('document', {
    getElementById(id: string) {
      let el = elements.get(id);
      if (!el) {
        el = { id, dataset: {}, hidden: false, textContent: '', title: '', disabled: false, lang: '', removeAttribute() { /* none */ } };
        elements.set(id, el);
      }
      return el;
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the usage count in the stage (wired into the runner status hook)', () => {
  it('counts run.workout once through starting, countdown and running, and setTarget still comes in the same tick, first', async () => {
    vi.useFakeTimers();
    stubDocument();
    const events: string[] = [];
    const steps: ProgramStep[] = [{ sec: 60, speed: 3 }, { sec: 60, speed: 4 }];
    let resolveStart!: (ok: boolean) => void;
    let stage: ReturnType<typeof setupStage> | null = null;
    const runner = new ProgramRunner({
      start: () => new Promise<boolean>(r => { resolveStart = r; }),
      stop: () => Promise.resolve(),
      setTarget: kmh => { events.push(`setTarget ${kmh}`); },
      currentTarget: () => null,
      distance: () => undefined,
      status: () => { stage?.render(); },
    }, { countdownMs: 1000, now: () => Date.now() });
    const host: StageHost = {
      chosen: { get: () => 'workout', set: () => undefined },
      workouts: { selectedInfo: () => ({ id: 'w', name: 'W', steps, description: null }), refresh: () => undefined },
      routes: {
        current: () => null, mapActive: () => false, refresh: () => undefined, refreshGoal: () => undefined,
        restart: () => undefined, walkRequest: () => null,
      } as never,
      interval: { render: () => undefined, renderPreview: () => undefined, reset: () => undefined },
      runner,
      recorder: { begin: () => 1, complete: () => undefined, settled: () => Promise.resolve() } as never,
      tm: { state: { target: null } as never, setProgramActive: () => undefined },
      connected: () => true,
      effectiveMax: () => 6,
      confirmStart: () => Promise.resolve(true),
      redrawChart: () => undefined,
      count: name => { events.push(`count ${name}`); },
    };
    stage = setupStage(host);

    const done = stage.runProgram();
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.phase).toBe('starting');
    // the first step's speed is held before the start, not sent while the belt stands
    expect(events).toEqual(['setTarget 3']);

    resolveStart(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.phase).toBe('countdown');

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner.phase).toBe('running');
    expect(events).toEqual(['setTarget 3', 'setTarget 3', 'count run.workout']);

    // Further ticks and the next step: no second count
    await vi.advanceTimersByTimeAsync(61_000);
    expect(events).toEqual(['setTarget 3', 'setTarget 3', 'count run.workout', 'setTarget 4']);

    runner.abort();
    await done;
    expect(events.filter(e => e.startsWith('count'))).toEqual(['count run.workout']);
  });
});
