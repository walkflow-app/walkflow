// The page in the background or on its way out: the screen stays on while connected (the wake lock), a belt that may be
// running is warned about or paused when the tab is hidden (the person's choice in the settings), a run is saved, and
// leaving the page while the belt may run asks first.
// Display and bookkeeping only: it pauses through the host, it sends nothing itself.

import { t, type Text } from '../i18n/i18n';
import { bindText } from './i18n-dom';
import { APP_NAME } from '../platform/config';
import { $, log } from './ui';
import { store } from './store';

const HIDDEN_MODE_KEY = 'walkflow.hiddenMode';

export interface BackgroundHost {
  connected(): boolean;
  /** The belt may be running (when in doubt it is) */
  maybeRunning(): boolean;
  /** Pause the belt; the reason is shown as the program's end */
  pause(reason: Text): Promise<boolean>;
  /** The program runner has to look at the clock (timers are throttled while hidden) */
  tick(): void;
  /** Save the run now */
  flush(): void;
  /** The browser releases the wake lock when the tab is hidden; take it again when the tab is back and connected */
  acquireWakeLock(): void | Promise<void>;
}

/** What the page says and shows; plain values, so a test needs no DOM */
export interface VisibilityPage {
  hidden(): boolean;
  /** The person's choice for a hidden tab */
  mode(): string;
  setTitle(title: string): void;
  /** Show the banner that tells what happened while the tab was hidden */
  showHiddenBanner(text: Text): void;
  now(): number;
}

/** The visibilitychange handler: warn or pause when the tab is hidden while the belt may run, save the run, tell on return */
export function visibilityHandler(host: BackgroundHost, page: VisibilityPage) {
  let hiddenSince: number | null = null;
  let hiddenWhileRunning: 'warned' | 'paused' | null = null;

  const onChange = () => {
    if (page.hidden()) {
      if (host.connected() && host.maybeRunning()) {
        hiddenSince = page.now();
        page.setTitle(t.hidden.title);
        if (page.mode() === 'pause') {
          hiddenWhileRunning = 'paused';
          log(t.hidden.pausingLog);
          void host.pause(() => t.hidden.pausedReason);
        } else {
          hiddenWhileRunning = 'warned';
          log(t.hidden.warnLog);
        }
      }
      // After the pause command has been queued, not before
      host.flush();
      return;
    }
    page.setTitle(APP_NAME);
    host.tick();
    if (host.connected()) void host.acquireWakeLock();
    if (hiddenSince !== null && hiddenWhileRunning) {
      const s = Math.round((page.now() - hiddenSince) / 1000);
      const how = hiddenWhileRunning;
      page.showHiddenBanner(() => how === 'paused' ? t.hidden.paused(s) : t.hidden.warned(s));
    }
    hiddenSince = null;
    hiddenWhileRunning = null;
  };
  onChange.relabel = () => { if (page.hidden() && hiddenSince !== null) page.setTitle(t.hidden.title); };
  return onChange;
}

export function setupBackground(host: Omit<BackgroundHost, 'acquireWakeLock'>) {
  let wakeLock: WakeLockSentinel | null = null;

  const mode = $<HTMLSelectElement>('hiddenMode');
  const saved = store.get(HIDDEN_MODE_KEY);
  if (saved === 'warn' || saved === 'pause') mode.value = saved;
  mode.onchange = () => {
    // Not while the belt runs (a select that commits as the locked settings close): back to what was stored
    if (host.connected() && host.maybeRunning()) {
      const stored = store.get(HIDDEN_MODE_KEY);
      mode.value = stored === 'pause' ? 'pause' : 'warn'; // 'warn' is the first option, the default
      return;
    }
    store.set(HIDDEN_MODE_KEY, mode.value);
  };

  async function acquireWakeLock() {
    if (wakeLock && !wakeLock.released) return;
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- the Wake Lock API is missing in Firefox and older Safari
    try { wakeLock = (await navigator.wakeLock?.request('screen')) ?? null; } catch { wakeLock = null; }
  }

  function releaseWakeLock() {
    try { void wakeLock?.release(); } catch { /* ignore */ }
    wakeLock = null;
  }

  const onVisibility = visibilityHandler({
    // Each method named, not spread: a spread would drop the methods of a class instance
    connected: () => host.connected(),
    maybeRunning: () => host.maybeRunning(),
    pause: reason => host.pause(reason),
    tick: () => host.tick(),
    flush: () => host.flush(),
    acquireWakeLock,
  }, {
    hidden: () => document.hidden,
    mode: () => mode.value,
    setTitle: title => { document.title = title; },
    showHiddenBanner: text => { bindText($('hiddenText'), text); $('hiddenBanner').hidden = false; },
    now: () => Date.now(),
  });
  document.addEventListener('visibilitychange', onVisibility);

  window.addEventListener('pagehide', () => host.flush());
  window.addEventListener('beforeunload', e => {
    if (host.connected() && host.maybeRunning()) e.preventDefault();
  });

  return {
    acquireWakeLock,
    releaseWakeLock,
    /** After a language change: the tab title while hidden */
    relabel: onVisibility.relabel,
  };
}
