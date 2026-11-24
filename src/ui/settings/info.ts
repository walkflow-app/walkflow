// The texts of the Info tab in the settings and the footer: what the app is, what it was tested with, where the source is.
// Filled in from the texts and the build settings; called at the start and after a language change.

import { t } from '../../i18n/i18n';
import { BUILD_TARGET, GITHUB_REPO, APP_VERSION } from '../../platform/config';
import { DONATION_URL } from '../../platform/donation';
import { USAGE_BASE } from '../../platform/features';
import { store } from '../store';
import { $, $input } from '../ui';
import { readUsageSwitch, USAGE_SWITCH_KEYS, usageSection, writeUsageSwitch } from './usage-switch';

export function renderInfo() {
  const ul = $('infoDisclaimer');
  ul.replaceChildren(...t.disclaimer.points.map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
  // Only in a build that sends counts; otherwise the section below says that nothing is sent
  const usage = $('infoDisclaimerUsage');
  usage.textContent = usageSection(USAGE_BASE) ? t.disclaimer.usage : '';
  usage.hidden = !usage.textContent;
  renderUsage();
  $('infoTested').textContent = t.info.tested(t.info.testedDevice, t.info.testedFeatures, t.info.untestedFeatures);
  $('infoAffiliation').textContent = t.info.notAffiliated;
  $('infoVersion').textContent = t.info.version(APP_VERSION);
  $('footerVersion').textContent = t.info.footer(APP_VERSION);

  const source = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}` : '';
  $('infoSource').replaceChildren(...(source ? [t.info.source, link(source, source.replace('https://', ''))] : []));
  const links: HTMLElement[] = [];
  if (BUILD_TARGET === 'web') links.push(link(t.info.imprintHref, t.info.imprint), link(t.info.privacyHref, t.info.privacyLink));
  if (source) links.push(link(source, t.info.sourceLink));
  // Nothing in return, no feature depends on it.
  links.push(link(DONATION_URL, t.info.donation));
  const support = $<HTMLAnchorElement>('supportLink');
  support.href = DONATION_URL;
  $('footerLinks').replaceChildren(...links.flatMap((a, i) => (i ? [' · ', a] : [a])));
}

/** The section "Usage data": without a counter in the build it says so and shows no switches (docs/USAGE.md) */
function renderUsage() {
  const section = usageSection(USAGE_BASE);
  $('infoUsageNone').hidden = !!section;
  $('infoUsageBody').hidden = !section;
  if (!section) return;
  $('infoUsageWhere').textContent = t.info.usageWhere(section.host);
  $('infoUsageDocs').replaceChildren(...(GITHUB_REPO
    ? [link(`https://github.com/${GITHUB_REPO}/blob/main/docs/USAGE.md`, t.info.usageList)] : []));
  for (const [id, key] of [['usageImproveSwitch', USAGE_SWITCH_KEYS.improve], ['usageErrorsSwitch', USAGE_SWITCH_KEYS.errors]] as const) {
    const input = $input(id);
    input.checked = readUsageSwitch(store, key);
    input.onchange = () => writeUsageSwitch(store, key, input.checked);
  }
}

function link(href: string, text: string) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}
