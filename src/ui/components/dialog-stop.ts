// A Stop button in every dialog while the belt runs or may run. A modal dialog makes the rest of the page inert for mouse and touch,
// so the Stop buttons of the page cannot be reached while one is open (#46). It is drawn into each dialog and shown by
// style.css while <html data-running="1"> (main.ts sets it, from dialogStopShown).
// A press stops the belt first, then cancels the dialog the way Esc would.

import { initialFocusIndex } from '../../core/safety/dialog-stop';
import { onLanguageChange, t } from '../../i18n/i18n';

let stop: () => void = () => {};

/** The stop of the belt (main.ts), never held back */
export function setDialogStop(fn: () => void) { stop = fn; }

/** A Stop that follows the language, for a dialog that is built once and stays open across a language change (the settings,
 *  the device chooser, the PIN) */
export function lastingDialogStopButton(dlg: HTMLDialogElement): HTMLButtonElement {
  const b = dialogStopButton(dlg);
  const off = onLanguageChange(() => { b.textContent = t.control.stop; });
  // A dialog that is removed after it closes (the chooser, the PIN) lets go of the listener; the settings stay in the page
  dlg.addEventListener('close', () => { if (!dlg.isConnected) off(); });
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

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/** The focus of a freshly opened dialog: never on the Stop (it comes first in the tab order), so Enter or Space on opening
 *  cannot stop the belt by surprise. Esc and a click on the Stop still work. */
export function focusInitial(dlg: HTMLDialogElement) {
  const els = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)];
  // Hidden: the hidden attribute, or display:none (also of a parent, e.g. an inactive tab), which leaves no client rects
  const i = initialFocusIndex(els.map(e => ({
    stop: e.classList.contains('dlg-stop'),
    disabled: (e as HTMLButtonElement).disabled,
    hidden: e.hidden !== false || e.getClientRects().length === 0,
  })));
  els[i]?.focus();
}
