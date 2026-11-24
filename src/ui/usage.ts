// The sender of the anonymous usage counts (docs/USAGE.md). `count(name)` is one synchronous call that cannot throw and is
// never awaited: a request that fails, is blocked or never answers changes nothing. A name is sent at most once per start (a
// set in memory; nothing is stored for it). Nothing is sent before the first-start popup is accepted; what comes before is
// dropped, not queued, and not remembered, so it can still be sent later in the same start. Level 1 ignores the switches.

import { DISCLAIMER_STORAGE_KEY, isDisclaimerAccepted } from '../core/safety/disclaimer';
import { DEV_MODE_STORAGE_KEY, readDevMode } from '../core/safety/dev-mode';
import { levelOf, USAGE_ERRORS_KEY, USAGE_IMPROVE_KEY, usageSwitchOn, type UsageLevel, type UsageName } from '../core/usage/events';
import { USAGE_BASE } from '../platform/features';
import { usageCountUrl } from '../platform/usage-url';
import { store } from './store';
import { log } from './ui';

export interface UsageDeps {
  /** The counting site, or null: nothing is ever sent */
  base: string | null;
  read(key: string): string | null;
  send(url: string): void;
  log(msg: string): void;
}

const SWITCH_KEY: Record<UsageLevel, string | null> = { 1: null, 2: USAGE_IMPROVE_KEY, 3: USAGE_ERRORS_KEY };

/** A name that could not be built (null) counts nothing */
export function createSender(deps: UsageDeps): (name: UsageName | null) => void {
  const sent = new Set<string>();
  return name => {
    try {
      const base = deps.base;
      const level = name === null ? null : levelOf(name);
      if (!base || !name || level === null || sent.has(name)) return;
      if (!isDisclaimerAccepted(deps.read(DISCLAIMER_STORAGE_KEY))) return;
      const key = SWITCH_KEY[level];
      if (key && !usageSwitchOn(deps.read(key))) return;
      sent.add(name);
      deps.send(usageCountUrl(base, name));
      if (readDevMode(deps.read(DEV_MODE_STORAGE_KEY))) deps.log(`usage: ${name}`);
    } catch { /* a count never breaks anything */ }
  };
}

export const count = createSender({
  base: USAGE_BASE,
  read: key => store.get(key),
  send: url => {
    // Fire and forget; the answer of a no-cors request cannot be read anyway
    void Promise.resolve(fetch(url, { mode: 'no-cors', keepalive: true })).catch(() => undefined);
  },
  log,
});
