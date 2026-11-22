// The settings are locked while the belt runs: the limit, the ramp and the other safety values are not changed in the middle
// of a run. Decided here without a DOM, so it can be tested; src/ui/settings/settings-ui.ts and src/ui/live/speed-controls.ts
// act on it.

interface BeltState {
  connected: boolean;
  maybeRunning: boolean;
}

/** Locked while connected and the belt may run (when in doubt it runs) */
export const settingsLocked = (s: BeltState): boolean => s.connected && s.maybeRunning;

/**
 * One check of the lock (on every change of the belt and every 500 ms). While locked an open dialog is closed, on every
 * check, so it cannot stay open however it was opened; a change typed into it is not taken (safetySettingsEditable).
 */
export function lockStep(locked: boolean, dialogOpen: boolean): { locked: boolean; close: boolean } {
  return { locked, close: locked && dialogOpen };
}

/** The limit and the step take a change only while the belt stands (or nothing is connected) */
export const safetySettingsEditable = (s: BeltState): boolean => !settingsLocked(s);
