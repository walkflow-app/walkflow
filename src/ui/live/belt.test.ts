import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTreadmill } from 'ftms-treadmill';
import { SimulatorAdapter } from 'ftms-treadmill/sim';
import { controlHandlers, keydownHandler, type KeyEventLike, type KeyPage, type KeyTarget } from './controls';
import { visibilityHandler, type VisibilityPage } from '../background';
// The page is not what is tested: the bytes are. The two modules that read the DOM are replaced.
vi.mock('../ui', () => ({ $: vi.fn(), $button: vi.fn(), log: vi.fn() }));
vi.mock('../i18n-dom', () => ({ bindText: vi.fn() }));

import { createBelt, globalStop } from './belt';

// The glue between buttons, keys, the hidden tab and the belt (#49). The real library (createTreadmill) with the simulated
// treadmill; every Control Point write is recorded, so the assertions are on the bytes the belt gets. No DOM: the handlers take
// plain objects (controls.ts, belt.ts, ../background.ts); setupControls and setupBackground only bind them.

const STOP = [0x08, 0x01];
const PAUSE = [0x08, 0x02];

async function rig() {
  const tm = createTreadmill({ speedLimit: 8, maxStep: 1 });
  const adapter = new SimulatorAdapter({ countdownMs: 500 });
  const writes: number[][] = [];
  // The adapter hands out one device; every write to it is recorded before it goes on
  const requestDevice = adapter.requestDevice.bind(adapter);
  adapter.requestDevice = async () => {
    const device = await requestDevice();
    const write = device.write.bind(device);
    device.write = (service, characteristic, data) => { writes.push([...data]); return write(service, characteristic, data); };
    return device;
  };
  const connecting = tm.connect(adapter);
  await vi.advanceTimersByTimeAsync(2000);
  await connecting;
  const started = tm.start();
  await vi.advanceTimersByTimeAsync(5000);
  await started;
  writes.length = 0;
  const abort = vi.fn();
  const belt = createBelt(tm, abort);
  return { tm, adapter, writes, belt, abort };
}

const sent = (writes: number[][], bytes: number[]) => writes.filter(w => w.length === bytes.length && w.every((b, i) => b === bytes[i])).length;
const settle = () => vi.advanceTimersByTimeAsync(3000);

const key = (k: string, target: Partial<KeyTarget> = {}): KeyEventLike => ({
  key: k, code: k === ' ' ? 'Space' : k, repeat: false, preventDefault: vi.fn(),
  target: () => ({ tag: 'BODY', type: '', editable: false, onMap: false, ...target }),
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the buttons', () => {
  it('Stop and the stop bar send 08 01', async () => {
    const r = await rig();
    const h = controlHandlers({ belt: r.belt });
    h.stop();
    await settle();
    expect(sent(r.writes, STOP)).toBe(1);
    h.sbStop();
    await settle();
    expect(sent(r.writes, STOP)).toBe(2);
  });

  it('Pause sends 08 02', async () => {
    const r = await rig();
    controlHandlers({ belt: r.belt }).pause();
    await settle();
    expect(sent(r.writes, PAUSE)).toBe(1);
  });
});

describe('the keys', () => {
  async function keys() {
    const r = await rig();
    const page: KeyPage = { dialogOpen: () => false, view: () => 'training', blurFocus: vi.fn() };
    const step = vi.fn();
    const onKey = keydownHandler({ connected: () => r.tm.state.connected, belt: r.belt, speed: { step } }, page);
    return { ...r, onKey, step, page };
  }

  it('Escape sends 08 01, also in a text field', async () => {
    const r = await keys();
    r.onKey(key('Escape', { tag: 'INPUT', type: 'text' }));
    await settle();
    expect(sent(r.writes, STOP)).toBe(1);
  });

  it('Escape sends 08 01 even when reading the target would throw', async () => {
    const r = await keys();
    const e = key('Escape');
    e.target = () => { throw new Error('no target'); };
    r.onKey(e);
    await settle();
    expect(sent(r.writes, STOP)).toBe(1);
  });

  it('Escape outside a dialog is prevented', async () => {
    const r = await keys();
    const e = key('Escape');
    r.onKey(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('Space sends 08 01 outside text fields and never inside one', async () => {
    const r = await keys();
    r.onKey(key(' ', { tag: 'INPUT', type: 'text' }));
    await settle();
    expect(sent(r.writes, STOP)).toBe(0);
    r.onKey(key(' '));
    await settle();
    expect(sent(r.writes, STOP)).toBe(1);
  });

  it('Escape in an open dialog stops but is not prevented (the dialog still closes)', async () => {
    const r = await keys();
    r.page.dialogOpen = () => true;
    const e = key('Escape');
    r.onKey(e);
    await settle();
    expect(sent(r.writes, STOP)).toBe(1);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('does nothing when not connected', async () => {
    const r = await rig();
    const onKey = keydownHandler({ connected: () => false, belt: r.belt, speed: { step: vi.fn() } }, { dialogOpen: () => false, view: () => 'training', blurFocus: vi.fn() });
    onKey(key('Escape'));
    await settle();
    expect(r.writes).toEqual([]);
  });

  it('the arrows change the speed, they do not stop', async () => {
    const r = await keys();
    r.onKey(key('ArrowUp'));
    r.onKey(key('ArrowDown'));
    expect(r.step.mock.calls).toEqual([[1], [-1]]);
    await settle();
    expect(sent(r.writes, STOP)).toBe(0);
  });
});

describe('the tab goes to the background', () => {
  async function hidden(mode: 'warn' | 'pause') {
    const r = await rig();
    const page: VisibilityPage = {
      hidden: () => true, mode: () => mode, setTitle: vi.fn(), showHiddenBanner: vi.fn(), now: () => Date.now(),
    };
    const order: string[] = [];
    const flush = vi.fn(() => { order.push('flush'); });
    const onChange = visibilityHandler({
      connected: () => r.tm.state.connected,
      maybeRunning: () => r.tm.state.maybeRunning,
      pause: reason => { order.push('pause'); return r.belt.pause(reason); },
      tick: vi.fn(), flush, acquireWakeLock: vi.fn(),
    }, page);
    return { ...r, onChange, flush, page, order };
  }

  it('in pause mode the belt gets 08 02', async () => {
    const r = await hidden('pause');
    r.onChange();
    await settle();
    expect(sent(r.writes, PAUSE)).toBe(1);
    expect(sent(r.writes, STOP)).toBe(0);
    expect(r.abort).toHaveBeenCalledTimes(1);
    expect(r.flush).toHaveBeenCalled();
    // The run is saved after the pause command has been queued, not before
    expect(r.order).toEqual(['pause', 'flush']);
  });

  it('in warn mode nothing is sent', async () => {
    const r = await hidden('warn');
    r.onChange();
    await settle();
    expect(r.writes).toEqual([]);
    expect(r.flush).toHaveBeenCalled();
  });
});

describe('the global shortcut and a stop with a reason', () => {
  it('the global stop shortcut sends 08 01 and ends the program', async () => {
    const r = await rig();
    const log = vi.fn();
    globalStop({ connected: () => r.tm.state.connected, belt: r.belt, log, reason: () => 'shortcut' });
    await settle();
    expect(sent(r.writes, STOP)).toBe(1);
    expect(r.abort).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('the global stop shortcut does nothing when not connected', async () => {
    const r = await rig();
    globalStop({ connected: () => false, belt: r.belt, log: vi.fn(), reason: () => 'shortcut' });
    await settle();
    expect(r.writes).toEqual([]);
  });

  it('a stop with a reason aborts the program first, then stops', async () => {
    const r = await rig();
    const order: string[] = [];
    r.abort.mockImplementation(() => { order.push('abort'); });
    const stop = r.tm.stop.bind(r.tm);
    r.tm.stop = () => { order.push('stop'); return stop(); };
    void r.belt.stop(() => 'because');
    await settle();
    expect(order).toEqual(['abort', 'stop']);
  });
});
