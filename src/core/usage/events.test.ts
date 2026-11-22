import { describe, expect, it } from 'vitest';
import { appStartName, featureName, FIXED_NAMES, langName, levelOf, PATTERNS, storeRouteName, usageSwitchOn, viewName } from './events';

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
    for (const s of ['', 'app.web', 'app.web.v0.7', 'app.web.v0.7.2/x', 'app.web.v0.7.2&p=x', 'app.ios.v0.7.2', 'lang.es', 'lang.en.x', 'view.community', 'Lang.en', 'x\napp.web.v0.7.2']) expect(levelOf(s), s).toBeNull();
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

describe('level 2 names of the views, editors, exports and the store', () => {
  const FEATURES = [
    'view.training', 'view.workouts', 'view.routes', 'view.history', 'workout.interval', 'workout.weekplan', 'workout.import',
    'route.own', 'route.gpx', 'route.map-on', 'history.csv', 'history.tcx', 'store.open', 'store.add',
  ] as const;

  it('every feature name is a fixed name of level 2', () => {
    for (const n of FEATURES) {
      expect(featureName(n)).toBe(n);
      expect(FIXED_NAMES).toContain(n);
      expect(levelOf(n), n).toBe(2);
    }
  });

  it('viewName builds the four views and nothing else (not community)', () => {
    expect(['training', 'workouts', 'routes', 'history'].map(viewName)).toEqual(['view.training', 'view.workouts', 'view.routes', 'view.history']);
    for (const v of ['community', '', 'History', 'x&p=1', '__proto__', 'training ']) expect(viewName(v), v).toBeNull();
  });

  const INDEX = ['lake-x.walkflow', 'alps.v2.walkflow'];

  it('storeRouteName builds a name only for a file of the index list', () => {
    expect(storeRouteName('lake-x.walkflow', INDEX)).toBe('store.route.lake-x');
    expect(storeRouteName('alps.v2.walkflow', INDEX)).toBe('store.route.alps.v2');
    expect(levelOf('store.route.lake-x')).toBe(2);
  });

  it('storeRouteName builds nothing for a file that is not in the list', () => {
    expect(storeRouteName('my-own-route.walkflow', INDEX)).toBeNull();
    expect(storeRouteName('lake-x.walkflow', [])).toBeNull();
    expect(storeRouteName('lake-x', INDEX)).toBeNull();
    expect(storeRouteName('Lake X.walkflow', ['Lake X.walkflow'])).toBeNull();
  });

  it('knows no other store.route name than a plain file name', () => {
    for (const s of ['store.route.', 'store.route.A', 'store.route.a b', 'store.route.a&p=1', 'store.route.a/b', 'store.other']) expect(levelOf(s), s).toBeNull();
  });
});
