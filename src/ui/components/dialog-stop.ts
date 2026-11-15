// A Stop button in every dialog while the belt may run. A modal dialog makes the rest of the page inert for mouse and touch,
// so the Stop buttons of the page cannot be reached while one is open (#46). It is drawn into each dialog and shown by
// style.css while <html data-running="1"> (main.ts sets it, from settingsLocked: connected and the belt may run).
// A press stops the belt first, then cancels the dialog the way Esc would.

import { onLanguageChange, t } from '../../i18n/i18n';

let stop: () => void = () => {};

/** The stop of the belt (main.ts), never held back */
export function setDialogStop(fn: () => void) { stop = fn; }

/** A Stop that follows the language, for a dialog that lives as long as the page (the settings) */
export function lastingDialogStopButton(dlg: HTMLDialogElement): HTMLButtonElement {
  const b = dialogStopButton(dlg);
  onLanguageChange(() => { b.textContent = t.control.stop; });
  return b;
}

/** A Stop for a dialog that is built for one question (it is drawn again on a language change, or not at all) */
export function dialogStopButton(dlg: HTMLDialogElement): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'stop dlg-stop';
  b.textContent = t.control.stop;
  b.onclick = () => {
    stop();
    // A dialog that handles its cancel closes itself (and may stay, if it must be answered); one that does not is closed
    const cancel = new Event('cancel', { cancelable: true });
    if (dlg.dispatchEvent(cancel) && dlg.open) dlg.close();
  };
  return b;
}
