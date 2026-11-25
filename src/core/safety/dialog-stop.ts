// The Stop button inside dialogs (#73, after #57). Decided here without a DOM so it can be tested; main.ts and
// src/ui/components/dialog-stop.ts act on it.

/** The Stop in a dialog shows whenever the treadmill is connected, not only when the belt is reported as running: a start
 *  from the treadmill itself may not be reported yet, and up to 250 ms pass between a start and the next check. */
export const dialogStopShown = (s: { connected: boolean; maybeRunning: boolean }): boolean => s.connected;

/** Which control of a dialog gets the focus when it opens: the first that is not the Stop, not disabled and not hidden
 *  (focus() on a hidden one does nothing and would leave the focus on the Stop), so Enter or Space on opening never stops the
 *  belt by surprise. The Stop only when it is the only one. -1: nothing can take focus. */
export function initialFocusIndex(controls: { stop: boolean; disabled?: boolean; hidden?: boolean }[]): number {
  const usable = (c: { disabled?: boolean; hidden?: boolean }) => !c.disabled && !c.hidden;
  const i = controls.findIndex(c => !c.stop && usable(c));
  if (i >= 0) return i;
  return controls.findIndex(c => c.stop && usable(c));
}
