// The Target figure in the training view: the speed the next Start will ramp to. ftms-treadmill ramps at Start to
// `governor.target ?? wanted`: `tm.state.target` is null after a Stop or Pause (and on a new connection), but the library
// keeps the last target in `wanted` until a disconnect. The figure follows that rule with the last target kept here: a dash
// only when Start will not ramp, never the slider's position, which would claim a speed the belt will not be brought to.

export const NO_TARGET_TEXT = '–';

/** The last non-null target on this connection, or null (nothing asked for yet, or the connection ended) */
export type TargetMemory = number | null;

/**
 * The speed Start will ramp to (what the figure shows), or null for none. A target the governor holds is already within
 * the range; the remembered one may be above a limit lowered since (allowed while the belt stands), and the library clamps
 * it at Start (`governor.request` → `clampSpeed`, pinned in tests/target-figure-library.test.ts), so it is shown clamped (null if the range is empty: Start ramps to nothing then).
 */
export function shownTarget(target: number | null, last: TargetMemory, range: { min: number; max: number }): number | null {
  if (target !== null) return target;
  if (last === null || range.max < range.min) return null;
  return Math.min(range.max, Math.max(range.min, last));
}

/** The memory after the target changed (`target` is what tm.state.target is now) or the connection ended */
export function afterTarget(last: TargetMemory, target: number | null, disconnected = false): TargetMemory {
  return disconnected ? null : target ?? last;
}

export function targetFigureText(shown: number | null, format: (kmh: number) => string): string {
  return shown === null ? NO_TARGET_TEXT : format(shown);
}
