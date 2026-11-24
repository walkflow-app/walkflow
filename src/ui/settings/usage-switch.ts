// The two switches of the anonymous usage counts (docs/USAGE.md) and what the Info section says about where they go. Only the
// person's own choice is stored: absent means on, "0" means off. Nothing here sends anything.

import { USAGE_ERRORS_KEY, USAGE_IMPROVE_KEY, usageSwitchOn } from '../../core/usage/events';

export const USAGE_SWITCH_KEYS = { improve: USAGE_IMPROVE_KEY, errors: USAGE_ERRORS_KEY } as const;

export interface SwitchIo {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const readUsageSwitch = (io: Pick<SwitchIo, 'get'>, key: string): boolean => usageSwitchOn(io.get(key));

/** Off writes "0", on removes the key (the default) */
export function writeUsageSwitch(io: Pick<SwitchIo, 'set' | 'remove'>, key: string, on: boolean): void {
  if (on) io.remove(key);
  else io.set(key, '0');
}

/** What the Info section shows: the host the counts go to, or null when this build sends nothing (no text about a place, no switches) */
export function usageSection(base: string | null): { host: string } | null {
  if (!base) return null;
  try { return { host: new URL(base).host }; } catch { return null; }
}
