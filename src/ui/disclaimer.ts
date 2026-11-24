// The notice on the first run (and again when its text changes): what the app is, that it is used at one's own risk.
// Nothing connects before it was accepted.

import { DISCLAIMER_STORAGE_KEY, DISCLAIMER_VERSION, isDisclaimerAccepted } from '../core/safety/disclaimer';
import { t } from '../i18n/i18n';
import { choose } from './components/dialogs';
import { USAGE_BASE } from '../platform/features';
import { usageSection } from './settings/usage-switch';
import { store } from './store';

export const disclaimerAccepted = () => isDisclaimerAccepted(store.get(DISCLAIMER_STORAGE_KEY));

export async function ensureDisclaimer(): Promise<boolean> {
  if (disclaimerAccepted()) return true;
  const r = await choose(() => ({
    title: t.disclaimer.title,
    list: t.disclaimer.points,
    // The notice of the anonymous usage counts (docs/USAGE.md), apart from the safety points; only in a build that sends them
    footnotes: usageSection(USAGE_BASE) ? [t.disclaimer.usage] : [],
    requireCheckbox: t.disclaimer.checkbox,
    buttons: [{ id: 'ok', label: t.disclaimer.accept, kind: 'primary' }, { id: 'later', label: t.disclaimer.later }],
    cancelId: 'later',
    languagePicker: true,
  }));
  if (r !== 'ok') return false;
  store.set(DISCLAIMER_STORAGE_KEY, String(DISCLAIMER_VERSION));
  return true;
}
