import { describe, expect, it } from 'vitest';
import { appStartName, FIXED_NAMES, langName, levelOf, PATTERNS, usageSwitchOn } from './events';

describe('appStartName (level 1)', () => {
  it('is the platform and the version', () => {
    expect(appStartName(undefined, '0.7.2')).toBe('app.web.v0.7.2');
    expect(appStartName('win32', '0.7.2')).toBe('app.win.v0.7.2');
    expect(appStartName('darwin', '10.20.30')).toBe('app.mac.v10.20.30');
    expect(appStartName('linux', '0.7.2')).toBe('app.linux.v0.7.2');
  });

  it('builds nothing for another platform', () => {
    for (const p of ['', 'freebsd', 'android', 'WIN32', 'web', 'win', '__proto__', 'constructor', 'toString']) expect(appStartName(p, '0.7.2'), p).toBeNull();
  });

  it('builds nothing for a version that is not x.y.z (a pre-release, or anything typed)', () => {
    for (const v of ['', '0.7', '0.7.2-beta.1', 'v0.7.2', '0.7.2.1', '0.7.x', '0.7.2 ', 'a.b.c', '0.7.2&x=1', '0.7.2\n']) expect(appStartName('win32', v), v).toBeNull();
  });
});

describe('langName (level 2)', () => {
  it('is lang.<language> for the four languages', () => {
    expect(['en', 'de', 'fr', 'uk'].map(langName)).toEqual(['lang.en', 'lang.de', 'lang.fr', 'lang.uk']);
  });

  it('builds nothing for any other string', () => {
    for (const l of ['', 'EN', 'es', 'en-US', 'en&x=1', 'en ', '__proto__']) expect(langName(l), l).toBeNull();
  });
});

describe('levelOf', () => {
  it('knows the names built here, with their levels', () => {
    expect(levelOf('app.web.v0.7.2')).toBe(1);
    expect(levelOf('lang.de')).toBe(2);
  });

  it('knows nothing else: an outside string has no level, so the sender sends nothing for it', () => {
    for (const s of ['', 'app.web', 'app.web.v0.7', 'app.web.v0.7.2/x', 'app.web.v0.7.2&p=x', 'app.ios.v0.7.2', 'lang.es', 'lang.en.x', 'view.training', 'Lang.en', 'x\napp.web.v0.7.2']) expect(levelOf(s), s).toBeNull();
  });

  it('gives a level to every fixed name', () => {
    for (const n of FIXED_NAMES) expect(levelOf(n), n).not.toBeNull();
    expect(PATTERNS.length).toBeGreaterThan(0);
  });
});

describe('usageSwitchOn', () => {
  it('is on unless the stored value is exactly "0"', () => {
    expect(usageSwitchOn(null)).toBe(true);
    expect(usageSwitchOn('1')).toBe(true);
    expect(usageSwitchOn('')).toBe(true);
    expect(usageSwitchOn('off')).toBe(true);
    expect(usageSwitchOn('0')).toBe(false);
  });
});
