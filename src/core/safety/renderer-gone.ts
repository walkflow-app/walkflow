// The window of the desktop app is gone (Electron's render-process-gone). The Bluetooth connection lived in it: the belt may
// still run, and nothing in the app can stop it any more. Every end but a clean exit gets a native warning (electron/main.ts).

export const warnWhenRendererGone = (reason: string): boolean => reason !== 'clean-exit';
