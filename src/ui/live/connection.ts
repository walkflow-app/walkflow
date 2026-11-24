// The connection to the treadmill as the person sees it: connecting (the real one or the demo), disconnecting, a connection
// that is lost, the header status, and which buttons need a connection. It owns the two adapters. The treadmill itself
// (connecting, asking for control, forgetting the belt) is the ftms-treadmill library; what it reports is shown by live-data.ts.

import type { BleAdapter, ConnectResult, Treadmill } from 'ftms-treadmill';
import { SimulatorAdapter } from 'ftms-treadmill/sim';
import { WebBluetoothAdapter } from 'ftms-treadmill/web-bluetooth';
import type { RunSource } from '../../core/history/runs';
import type { ProgramRunner } from '../../core/training/program';
import type { UsageName } from '../../core/usage/events';
import { treadmillName, type DeviceInfo } from '../../core/usage/treadmill';
import { t, type Text } from '../../i18n/i18n';
import { APP_VERSION } from '../../platform/config';
import { choose, confirmDialog } from '../components/dialogs';
import { desktop } from '../desktop';
import { ensureDisclaimer } from '../disclaimer';
import { bindText } from '../i18n-dom';
import { $, $button, log } from '../ui';
import { countError } from '../usage';
import { stopPlacement, type View } from '../views';
import type { BeltBanner } from './belt-banner';
import { connectErrorKind, createLossTracker } from './error-kinds';
import { errorText } from './treadmill-text';

export interface ConnectionHost {
  tm: Pick<Treadmill, 'state' | 'connect' | 'disconnect' | 'on'>;
  banner: Pick<BeltBanner, 'setConnected'>;
  runner: Pick<ProgramRunner, 'abort'>;
  speed: { applyLimits(): void };
  incline: {
    reset(): void;
    onConnected(info: ConnectResult, real: boolean): void;
  };
  background: { acquireWakeLock(): Promise<void>; releaseWakeLock(): void };
  recorder: { finish(): void };
  live: { setSource(s: RunSource): void; resetDeviceInfo(): void; deviceInfo(): DeviceInfo };
  /** The anonymous usage count (ui/usage.ts): synchronous, never throws, never awaited */
  count(name: UsageName | null): void;
  /** Stops the belt; the reason is shown as the end of a program */
  stop(reason: Text): Promise<boolean>;
  now(): number;
  renderStats(): void;
  renderBanner(): void;
  renderControls(): void;
  /** The settings are locked while the belt runs */
  renderSettingsLock(): void;
}

export function setupConnection(host: ConnectionHost) {
  const { tm, banner } = host;
  const webAdapter = new WebBluetoothAdapter();
  let sim: SimulatorAdapter | null = null;
  let view: View = 'training';
  let uiConnected = false;

  const connected = () => tm.state.connected;
  const maybeRunning = () => tm.state.maybeRunning;
  let connecting = false;
  // Counts a lost connection (docs/USAGE.md) but not the person's own Disconnect
  const loss = createLossTracker();

  tm.on('disconnected', ({ wasRunning }) => onDisconnected(wasRunning));

  async function connect(kind: 'ble' | 'demo') {
    if (connected() || connecting || !(await ensureDisclaimer())) return;
    connecting = true;
    $button('connect').disabled = true;
    $button('demo').disabled = true;
    try {
      setStatus(() => kind === 'demo' ? t.connection.demoConnecting : t.connection.searching);
      let adapter: BleAdapter = webAdapter;
      if (kind === 'demo') adapter = sim ??= new SimulatorAdapter({ version: APP_VERSION });
      const source: RunSource = kind === 'demo' ? 'demo' : 'ble';
      host.live.setSource(source);
      host.live.resetDeviceInfo();
      host.incline.reset();
      // Connects, reads the treadmill and asks for control
      const info = await tm.connect(adapter);
      loss.connected();
      // Raised after every connect that resolved (the sender sends a name once per start of the app; a failed connect counts nothing)
      // (the name is built inside a try: nothing about a count may skip the steps below)
      try { host.count(treadmillName(kind === 'demo' ? 'demo' : 'ble', host.live.deviceInfo())); } catch { /* a count never breaks anything */ }

      host.incline.onConnected(info, source === 'ble');
      host.renderStats();

      await host.background.acquireWakeLock();
      host.speed.applyLimits();
      setUi(true);
      $('alarm').hidden = true;
      $('stopAlarm').hidden = true;
      $('demoBanner').hidden = kind !== 'demo';
      const name = info.deviceName;
      bindText($('deviceName'), () => name ?? t.connection.defaultDeviceName);
      setStatus(() => {
        const shown = name ?? t.connection.defaultDeviceName;
        return kind === 'demo' ? t.connection.demoConnected(shown) : t.connection.connected(shown);
      }, () => (kind === 'demo' ? t.connection.demoConnectedShort : t.connection.connectedShort));
      desktop?.connectionChanged(true);
    } catch (e) {
      log(`❌ ${errorText(e)}`);
      if (!connected()) {
        countError(connectErrorKind(e));
        setStatus(() => t.connection.notConnected);
        setUi(false);
      } else {
        // Connected, but drawing something failed on the way (#49 C): the Stop buttons must not stay disabled, and the
        // desktop app must know (global stop shortcut, display sleep)
        desktop?.connectionChanged(true);
        setUi(true);
      }
    } finally {
      connecting = false;
    }
  }

  /** The treadmill has already forgotten the belt; the page follows */
  function onDisconnected(wasRunning: boolean) {
    log(t.disconnect.log);
    const lost = loss.lost();
    host.runner.abort(() => t.disconnect.programEnded);
    host.background.releaseWakeLock();
    desktop?.connectionChanged(false);
    setStatus(() => t.connection.notConnected);
    host.renderStats();
    $('demoBanner').hidden = true;
    // Without a connection there is nothing left to stop from here: the connection alarm below takes over
    $('stopAlarm').hidden = true;
    setUi(false);
    if (wasRunning) {
      $('alarm').hidden = false;
      $('alarm').scrollIntoView({ block: 'start' });
      log(t.disconnect.lostWhileRunning);
    }
    host.recorder.finish();
    // Last, so that nothing of the stop and the alarm above can wait for a count
    if (lost) countError('connection-lost');
  }

  async function disconnectClicked() {
    if (!connected()) return;
    if (maybeRunning()) {
      const choice = await choose({
        title: t.disconnect.runningTitle,
        paragraphs: [t.disconnect.runningText],
        buttons: [
          { id: 'stop', label: t.disconnect.stopFirst, kind: 'primary' },
          { id: 'force', label: t.disconnect.force },
          { id: 'cancel', label: t.common.cancel },
        ],
        cancelId: 'cancel',
      });
      if (choice === 'cancel') return;
      if (choice === 'stop') {
        const ok = await host.stop(() => t.stop.beforeDisconnect);
        if (!(ok && await waitUntil(() => !maybeRunning(), 10_000))) {
          const force = await confirmDialog(t.disconnect.stillMovingTitle, [t.disconnect.stillMovingText(tm.state.lastMeasured)], t.disconnect.force);
          if (!force) return;
        }
      }
    }
    loss.personDisconnects();
    tm.disconnect();
  }

  function waitUntil(cond: () => boolean, timeoutMs: number): Promise<boolean> {
    return new Promise(resolve => {
      const t0 = host.now();
      const check = () => {
        if (cond()) resolve(true);
        else if (host.now() - t0 >= timeoutMs || !connected()) resolve(false);
        else setTimeout(check, 200);
      };
      check();
    });
  }

  function setUi(isConnected: boolean) {
    // Layout switch (style.css): connection menu content, fixed control dock on narrow screens, stop bar
    uiConnected = isConnected;
    banner.setConnected(isConnected);
    host.renderBanner();
    document.documentElement.classList.toggle('connected', isConnected);
    applyStopPlacement();
    host.renderSettingsLock();
    $button('connect').disabled = isConnected || !$('unsupported').hidden;
    $button('demo').disabled = isConnected;
    $button('disconnect').disabled = !isConnected;
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.needs-conn').forEach(el => { el.disabled = !isConnected; });
    host.renderControls();
  }

  /** Status in the header; narrow screens show the short form (the device name is in the connection menu). */
  function setStatus(text: Text, short: Text = text) {
    bindText($('status'), text);
    bindText($('statusShort'), short);
  }

  /** Controls in the training view, the stop bar elsewhere while connected (tested in views.test.ts). */
  function applyStopPlacement() {
    document.documentElement.dataset.stop = stopPlacement(view, uiConnected);
  }

  return {
    connect, disconnectClicked, setUi, setStatus,
    /** The view changed (training, history, …): the stop bar follows */
    setView(v: View) { view = v; applyStopPlacement(); },
    /** The connection menu and the layout follow the connection (as last set by setUi) */
    uiConnected: () => uiConnected,
    /** Whether the browser can do Bluetooth at all and an adapter is there (not asked in the desktop app: the macOS prompt) */
    availability: () => webAdapter.availability(),
    /** The demo treadmill, once it was used: lets the demo buttons simulate a lost connection or a pulled key */
    simulator: () => sim,
  };
}
