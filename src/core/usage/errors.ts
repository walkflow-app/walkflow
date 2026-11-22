// Level 3 of the anonymous usage counts (docs/USAGE.md): the known errors, as `error.<kind>.v<version>` and nothing more. No
// message, stack or file ever becomes part of a name. Pure; the library's codes are mapped in ui/live/error-kinds.ts, which
// is where the treadmill library is allowed to be imported. A new kind is a line here, a line in docs/USAGE.md and a test.

import type { UsageName } from './events';

/** From the library (notice codes, then TreadmillErrorCode), then the app's own, then anything unexpected */
export const ERROR_KINDS = [
  'features-unreadable', 'speed-range-unreadable', 'write-failed', 'start-speed-failed', 'speed-refused',
  'no-gatt', 'not-connected', 'write-timeout',
  'connect-failed', 'connection-lost', 'map-style', 'file-read', 'store-add', 'update-failed',
  'unexpected',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** The names as docs/USAGE.md lists them */
export const ERROR_PATTERNS: readonly string[] = ERROR_KINDS.map(k => `error.${k}.v<x.y.z>`);

const NAME = new RegExp(`^error\\.(${ERROR_KINDS.join('|')})\\.v\\d+\\.\\d+\\.\\d+$`);

/** Is this a name built here for level 3 */
export const isErrorName = (name: string): boolean => NAME.test(name);

/** `error.<kind>.v<version>`; nothing for a version that is not x.y.z (a pre-release) or a kind that is not listed */
export function errorName(kind: ErrorKind, version: string): UsageName | null {
  if (!(ERROR_KINDS as readonly string[]).includes(kind) || !/^\d+\.\d+\.\d+$/.test(version)) return null;
  return `error.${kind}.v${version}` as UsageName;
}
