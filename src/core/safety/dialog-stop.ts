// The Stop button inside dialogs (#73, after #57). Decided here without a DOM so it can be tested; main.ts and
// src/ui/components/dialog-stop.ts act on it.

/** The Stop in a dialog shows while the belt runs or may run; with a standing belt there is nothing to stop. A start at the
 *  treadmill itself shows it once the treadmill has reported it (until then Esc and the treadmill's own Stop work). */
export const dialogStopShown = (s: { connected: boolean; maybeRunning: boolean }): boolean => s.connected && s.maybeRunning;

/** Which control of a dialog gets the focus when it opens: the first that is not the Stop, not disabled and not hidden
 *  (focus() on a hidden one does nothing and would leave the focus on the Stop), so Enter or Space on opening never stops the
 *  belt by surprise. The Stop only when it is the only one. -1: nothing can take focus. */
export function initialFocusIndex(controls: { stop: boolean; disabled?: boolean; hidden?: boolean }[]): number {
  const usable = (c: { disabled?: boolean; hidden?: boolean }) => !c.disabled && !c.hidden;
  const i = controls.findIndex(c => !c.stop && usable(c));
  if (i >= 0) return i;
  return controls.findIndex(c => c.stop && usable(c));
}
