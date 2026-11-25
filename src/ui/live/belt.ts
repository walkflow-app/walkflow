// Start, pause and stop as the rest of the page uses them: the one place where "the person wants the belt to stop" becomes a call
// to the treadmill. A reason is what a running program shows as its end; without one it shows what the treadmill says.
// Moved out of main.ts unchanged so that ui/live/belt.test.ts can call it (#49).

import type { Text } from '../../i18n/i18n';
import type { Treadmill } from 'ftms-treadmill';

export type TreadmillCommands = Pick<Treadmill, 'start' | 'stop' | 'pause'>;

export interface Belt {
  start: () => Promise<boolean>;
  stop: (reason?: Text) => Promise<boolean>;
  pause: (reason?: Text) => Promise<boolean>;
}

/** `abort` ends the running program with the reason; it runs before the command, so the program cannot start the belt again */
export function createBelt(tm: TreadmillCommands, abort: (reason: Text) => void): Belt {
  return {
    start: () => tm.start(),
    stop: (reason?: Text) => { if (reason) abort(reason); return tm.stop(); },
    pause: (reason?: Text) => { if (reason) abort(reason); return tm.pause(); },
  };
}

export interface GlobalStopHost {
  connected(): boolean;
  belt: Pick<Belt, 'stop'>;
  /** Logs the stop (the text is the caller's) */
  log(): void;
  /** What a running program shows as its end */
  reason: Text;
}

/** The desktop app's global Stop shortcut (it works while another window has the focus) */
export function globalStop(host: GlobalStopHost): void {
  if (!host.connected()) return;
  host.log();
  void host.belt.stop(host.reason);
}
