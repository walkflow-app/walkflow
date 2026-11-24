import { beforeEach, describe, expect, it, vi } from 'vitest';

// The DOM, the adapters and the dialogs are not what is tested here: when the usage count is raised is.
vi.mock('ftms-treadmill/sim', () => ({ SimulatorAdapter: function SimulatorAdapter() { /* not used: the stub treadmill ignores the adapter */ } }));
vi.mock('ftms-treadmill/web-bluetooth', () => ({ WebBluetoothAdapter: class { availability() { return 'ok'; } } }));
vi.mock('../disclaimer', () => ({ ensureDisclaimer: () => Promise.resolve(true) }));
vi.mock('../desktop', () => ({ desktop: null }));
vi.mock('../components/dialogs', () => ({ choose: vi.fn(), confirmDialog: vi.fn() }));
vi.mock('../i18n-dom', () => ({ bindText: vi.fn() }));
vi.mock('../ui', () => {
  const el = () => ({ disabled: false, hidden: false, scrollIntoView: vi.fn() });
  const els = new Map<string, ReturnType<typeof el>>();
  const get = (id: string) => { if (!els.has(id)) els.set(id, el()); return els.get(id)!; };
  return { $: get, $button: get, log: vi.fn() };
});

import { setupConnection, type ConnectionHost } from './connection';

function rig(connect: () => Promise<unknown>) {
  const order: string[] = [];
  let info = {};
  const host = {
    tm: { state: { connected: false, maybeRunning: false }, connect: vi.fn(() => { order.push('connect'); return connect(); }), disconnect: vi.fn(), on: vi.fn() },
    banner: { setConnected: vi.fn() },
    runner: { abort: vi.fn() },
    speed: { applyLimits: vi.fn() },
    incline: { reset: vi.fn(), onConnected: vi.fn() },
    background: { acquireWakeLock: () => Promise.resolve(), releaseWakeLock: vi.fn() },
    recorder: { finish: vi.fn() },
    live: {
      setSource: vi.fn(),
      resetDeviceInfo: vi.fn(() => { info = {}; order.push('reset'); }),
      deviceInfo: () => info,
    },
    count: vi.fn(() => { order.push('count'); }),
    stop: vi.fn(),
    now: () => 0,
    renderStats: vi.fn(), renderBanner: vi.fn(), renderControls: vi.fn(), renderSettingsLock: vi.fn(),
  };
  const conn = setupConnection(host as unknown as ConnectionHost);
  return { host, conn, order, setInfo: (i: object) => { info = i; } };
}

beforeEach(() => {
  vi.stubGlobal('document', { documentElement: { classList: { toggle: vi.fn() }, dataset: {} }, querySelectorAll: () => [] });
});

describe('the treadmill count', () => {
  it('is raised once, after connect resolved, with what the treadmill reported', async () => {
    // The notices come while connecting, after the reset
    const r = rig(() => { r.setInfo({ manufacturer: 'FITHOME', model: 'JJ-BT2-DL' }); return Promise.resolve({ deviceName: 'JJ-BT2-4F2A' }); });
    await r.conn.connect('ble');
    expect(r.host.count).toHaveBeenCalledTimes(1);
    expect(r.host.count).toHaveBeenCalledWith('tm.fithome.jj-bt2-dl');
    expect(r.order).toEqual(['reset', 'connect', 'count']);
  });

  it('is tm.unknown when no Device Information came', async () => {
    const r = rig(() => Promise.resolve({}));
    await r.conn.connect('ble');
    expect(r.host.count).toHaveBeenCalledWith('tm.unknown');
  });

  it('is tm.demo for the demo, whatever the simulator reports', async () => {
    const r = rig(() => { r.setInfo({ manufacturer: 'Walkflow' }); return Promise.resolve({}); });
    await r.conn.connect('demo');
    expect(r.host.count).toHaveBeenCalledTimes(1);
    expect(r.host.count).toHaveBeenCalledWith('tm.demo');
  });

  it('is not raised when connect fails', async () => {
    const r = rig(() => { r.setInfo({ manufacturer: 'FITHOME', model: 'JJ-BT2-DL' }); return Promise.reject(new Error('no device')); });
    await r.conn.connect('ble');
    expect(r.host.count).not.toHaveBeenCalled();
  });

  it('is not raised before connect resolves', async () => {
    let resolve!: (v: unknown) => void;
    const r = rig(() => new Promise(res => { resolve = res; }));
    const done = r.conn.connect('ble');
    await Promise.resolve();
    expect(r.host.count).not.toHaveBeenCalled();
    resolve({});
    await done;
    expect(r.host.count).toHaveBeenCalledTimes(1);
  });

  it('cannot skip the steps after connecting, whatever it throws', async () => {
    const r = rig(() => Promise.resolve({}));
    r.host.count.mockImplementation(() => { throw new Error('count'); });
    await r.conn.connect('ble');
    expect(r.host.incline.onConnected).toHaveBeenCalledTimes(1);
    expect(r.host.speed.applyLimits).toHaveBeenCalledTimes(1);

    const s = rig(() => Promise.resolve({}));
    s.host.live.deviceInfo = () => { throw new Error('info'); };
    await s.conn.connect('ble');
    expect(s.host.incline.onConnected).toHaveBeenCalledTimes(1);
    expect(s.host.speed.applyLimits).toHaveBeenCalledTimes(1);
  });
});
