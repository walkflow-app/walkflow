import { describe, expect, it } from 'vitest';
import { appStartName, langName } from '../../core/usage/events';
import { createSender } from '../usage';
import { readUsageSwitch, usageSection, USAGE_SWITCH_KEYS, writeUsageSwitch } from './usage-switch';
import { de } from '../../i18n/locales/de';
import { en } from '../../i18n/locales/en';
import { fr } from '../../i18n/locales/fr';
import { uk } from '../../i18n/locales/uk';

function memory(initial: Record<string, string> = {}) {
  const values = { ...initial };
  return {
    values,
    get: (k: string) => values[k] ?? null,
    set: (k: string, v: string) => { values[k] = v; },
    remove: (k: string) => { delete values[k]; },
  };
}

describe('the two usage switches', () => {
  it('are on when absent (an installation that accepted before)', () => {
    const io = memory({ 'walkflow.disclaimerAccepted': '1' });
    expect(readUsageSwitch(io, USAGE_SWITCH_KEYS.improve)).toBe(true);
    expect(readUsageSwitch(io, USAGE_SWITCH_KEYS.errors)).toBe(true);
  });

  it('off writes "0", on removes the key', () => {
    const io = memory();
    writeUsageSwitch(io, USAGE_SWITCH_KEYS.improve, false);
    expect(io.values).toEqual({ 'walkflow.usageImprove': '0' });
    expect(readUsageSwitch(io, USAGE_SWITCH_KEYS.improve)).toBe(false);
    writeUsageSwitch(io, USAGE_SWITCH_KEYS.improve, true);
    expect(io.values).toEqual({});
  });

  it('switched off, the sender sends no event of that level, and level 1 still goes', () => {
    const io = memory({ 'walkflow.disclaimerAccepted': '1' });
    const urls: string[] = [];
    const count = createSender({ base: 'https://x.goatcounter.com', read: io.get, send: u => urls.push(u), log: () => {} });
    writeUsageSwitch(io, USAGE_SWITCH_KEYS.improve, false);
    count(langName('en'));
    expect(urls).toEqual([]);
    count(appStartName(undefined, '0.7.2'));
    expect(urls).toHaveLength(1);
    writeUsageSwitch(io, USAGE_SWITCH_KEYS.improve, true);
    count(langName('en'));
    expect(urls).toHaveLength(2);
  });
});

describe('the usage section of the Info tab', () => {
  it('names the counter from the build setting', () => {
    expect(usageSection('https://walkflow.goatcounter.com')).toEqual({ host: 'walkflow.goatcounter.com' });
  });

  it('is the "this build sends nothing" text, without switches, when there is no build setting', () => {
    expect(usageSection(null)).toBeNull();
    expect(usageSection('not a url')).toBeNull();
  });
});

describe('the notice in the first-start popup', () => {
  it.each([['en', en], ['de', de], ['fr', fr], ['uk', uk]] as const)('has its own text in %s, apart from the safety points', (_n, loc) => {
    expect(loc.disclaimer.usage.length).toBeGreaterThan(20);
    expect(loc.disclaimer.points).not.toContain(loc.disclaimer.usage);
    expect(loc.info.usageWhere('c.goatcounter.com')).toContain('c.goatcounter.com');
  });
});
