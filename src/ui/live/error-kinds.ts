// Which known errors of the treadmill connection are counted (docs/USAGE.md, level 3), and as which kind. The library speaks in
// codes; this maps them to the kinds of core/usage/errors.ts. Nothing here reads a message, a stack or a name. The Records are
// exhaustive on purpose: a code the library adds does not compile until it is named here (null = not an error to count).

import { TreadmillError, type Notice, type TreadmillErrorCode } from 'ftms-treadmill';
import type { ErrorKind } from '../../core/usage/errors';

/** Every notice code of the library: the failure ones map to a kind, the others are information */
export const NOTICE_ERROR_KINDS: Record<Notice['code'], ErrorKind | null> = {
  'device': null,
  'device-info': null,
  'not-subscribable': null,
  'features': null,
  'controllable': null,
  'features-unreadable': 'features-unreadable',
  'speed-range': null,
  'speed-range-unreadable': 'speed-range-unreadable',
  'incline-range': null,
  'incline-range-unreadable': null,
  'heart-rate': null,
  'write-dropped': null,
  'write-failed': 'write-failed',
  'no-allowed-speed': null,
  'speed-held-until-moving': null,
  'ramp-aborted': null,
  'start-speed-failed': 'start-speed-failed',
  'speed-refused': 'speed-refused',
  'limit-lowered': null,
  'limit-unconfirmed': null,
  'console-bad-bytes': null,
  'console-set-speed-length': null,
  'console-over-limit': null,
  'console-jump': null,
  'console-too-soon': null,
  'console-heart-rate': null,
};

/** Every `TreadmillError` code of the library */
export const THROWN_ERROR_KINDS: Record<TreadmillErrorCode, ErrorKind> = {
  'no-gatt': 'no-gatt',
  'not-connected': 'not-connected',
  'write-timeout': 'write-timeout',
};

/** The kind of a notice, or null when it is no failure */
export const noticeErrorKind = (n: Pick<Notice, 'code'>): ErrorKind | null => NOTICE_ERROR_KINDS[n.code] ?? null;

/** The kind of what `connect` threw: the library's own code, else `connect-failed`. Nothing of the message is read. */
export function connectErrorKind(e: unknown): ErrorKind {
  return e instanceof TreadmillError ? (THROWN_ERROR_KINDS[e.code]) : 'connect-failed';
}

/**
 * Tells a connection that was lost from one the person ended, and from a connect that failed on the way (the library
 * disconnects then too). `connected()` is called when `tm.connect` has succeeded; `personDisconnects()` just before the module
 * calls `tm.disconnect`; `lost()` in the handler of the disconnect event is true only for a connection that was up and that the
 * person did not end. It disarms, so each connection is judged once.
 */
export function createLossTracker(): { connected(): void; personDisconnects(): void; lost(): boolean } {
  let up = false;
  let byPerson = false;
  return {
    connected() { up = true; byPerson = false; },
    personDisconnects() { byPerson = true; },
    lost() {
      const lost = up && !byPerson;
      up = false;
      byPerson = false;
      return lost;
    },
  };
}
