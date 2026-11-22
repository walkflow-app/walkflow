// The treadmill model as a usage count (docs/USAGE.md): `tm.<maker>.<model>` from the Device Information the treadmill
// reports about itself, without a fixed list. A guard keeps out whatever could identify a device or a person. Pure; the
// advertised device name is never used, and the serial number is never read.

import type { UsageName } from './events';

/** What the connection learned from the `device-info` notices (firmware is ignored) */
export interface DeviceInfo {
  manufacturer?: string;
  model?: string;
}

const PLAIN = /^[a-z0-9._+-]{1,32}$/;
const MAC = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/**
 * The string as a part of a name, or null if it is left out: 1 to 32 characters from a-z 0-9 . _ - + (after lower case and
 * spaces to -), no run of 5 or more digits, none of 6 or more hex digits, no MAC address or UUID, not only digits.
 * (`@` and `/` are not in the character set.)
 */
export function guardPart(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replaceAll(' ', '-');
  if (!PLAIN.test(s)) return null;
  if (/\d{5,}/.test(s) || /[0-9a-f]{6,}/.test(s)) return null;
  // The same runs with the separators taken out: `ab12-cd34-ef56` is a serial number written in groups
  const joined = s.replace(/[._+-]/g, '');
  if (/\d{5,}/.test(joined) || /[0-9a-f]{6,}/.test(joined)) return null;
  if (MAC.test(s) || UUID.test(s) || /^\d+$/.test(s)) return null;
  return s;
}

/** `tm.demo` for the demo (never through the guard), else the guarded maker and model; a part left out is `unknown` */
export function treadmillName(kind: 'ble' | 'demo', info: DeviceInfo): UsageName {
  if (kind === 'demo') return 'tm.demo' as UsageName;
  const maker = guardPart(info.manufacturer);
  const model = guardPart(info.model);
  if (maker === null && model === null) return 'tm.unknown' as UsageName;
  return `tm.${maker ?? 'unknown'}.${model ?? 'unknown'}` as UsageName;
}

/** Is `rest` (what follows `tm.`) something treadmillName builds: `unknown`, `demo`, or two parts joined by a dot */
export function isTreadmillRest(rest: string): boolean {
  if (rest === 'unknown' || rest === 'demo') return true;
  const part = (p: string) => p === 'unknown' || guardPart(p) === p;
  for (let i = rest.indexOf('.'); i !== -1; i = rest.indexOf('.', i + 1)) {
    const maker = rest.slice(0, i);
    const model = rest.slice(i + 1);
    if (maker === 'unknown' && model === 'unknown') continue; // that is `tm.unknown`
    if (part(maker) && part(model)) return true;
  }
  return false;
}
