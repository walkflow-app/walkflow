// Counts which kind of run starts (docs/USAGE.md, run.*). Read-only: it looks at what already happened and never sits in the
// way to the belt. A count that throws changes nothing.

import { runName, type UsageName } from '../../core/usage/events';

export type Count = (name: UsageName | null) => void;

function safeCount(count: Count, kind: string) {
  try { count(runName(kind)); } catch { /* a count never breaks anything */ }
}

/** Free training: counts after the start resolved with success; a rejection or a failure counts nothing. */
export async function startFree(start: () => Promise<boolean>, count: Count): Promise<void> {
  if (await start()) safeCount(count, 'free');
}

/** A workout or route: counts once per run, the first time it is seen with its program in the countdown or running.
 *  The runner does not report during the countdown, so in practice that is its first running step (docs/USAGE.md). */
export function createRunCounter(count: Count) {
  let counted: object | null = null;
  return (run: { kind: string } | null, phase: string) => {
    if (!run || counted === run || (phase !== 'countdown' && phase !== 'running')) return;
    counted = run;
    safeCount(count, run.kind);
  };
}
