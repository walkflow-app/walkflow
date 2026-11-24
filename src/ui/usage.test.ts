import { describe, expect, it } from 'vitest';
import { ERROR_KINDS, errorName } from '../core/usage/errors';
import { appStartName, langName, type UsageName } from '../core/usage/events';
import { countUnexpected, createSender } from './usage';

const BASE = 'https://walkflow.goatcounter.com';
const APP = appStartName(undefined, '0.7.2')!;
const LANG = langName('en')!;
const OK = { 'walkflow.disclaimerAccepted': '1' };

function setup(stored: Record<string, string> = OK, base: string | null = BASE) {
  const values = { ...stored };
  const urls: string[] = [];
  const lines: string[] = [];
  const count = createSender({ base, read: k => values[k] ?? null, send: u => urls.push(u), log: m => lines.push(m) });
  return { values, urls, lines, count };
}

describe('the sender of usage counts', () => {
  it('sends one request to /count of the counter, with the name as page and title, as an event', () => {
    const { count, urls } = setup();
    count(APP);
    expect(urls).toEqual([`${BASE}/count?p=app.web.v0.7.2&t=app.web.v0.7.2&e=true`]);
  });

  it('sends each name at most once per start', () => {
    const { count, urls } = setup();
    count(APP); count(APP); count(LANG); count(LANG); count(APP);
    expect(urls).toHaveLength(2);
  });

  it('sends nothing without a counter in the build', () => {
    for (const base of [null, '']) {
      const { count, urls } = setup(OK, base);
      count(APP); count(LANG);
      expect(urls, String(base)).toEqual([]);
    }
  });

  it('sends nothing for a name that was not built by the code, or none', () => {
    const { count, urls } = setup();
    count(null);
    count('page.x&p=secret' as UsageName);
    count('lang.es' as UsageName);
    expect(urls).toEqual([]);
  });

  it('sends nothing before the first-start popup was accepted, level 1 too', () => {
    const cases: Record<string, string>[] = [{}, { 'walkflow.disclaimerAccepted': '0' }, { 'walkflow.disclaimerAccepted': '2' }, { 'walkflow.disclaimerAccepted': 'true' }];
    for (const stored of cases) {
      const { count, urls } = setup(stored);
      count(APP); count(LANG);
      expect(urls, JSON.stringify(stored)).toEqual([]);
    }
  });

  it('drops what comes before the popup is accepted, never queues it, and sends it when it is raised again afterwards', () => {
    const { count, urls, values } = setup({});
    count(APP); count(LANG);
    values['walkflow.disclaimerAccepted'] = '1';
    expect(urls).toEqual([]);
    count(APP);
    expect(urls).toEqual([`${BASE}/count?p=app.web.v0.7.2&t=app.web.v0.7.2&e=true`]);
    count(APP);
    expect(urls).toHaveLength(1);
  });

  it('is on with the key "1" and no switches', () => {
    const { count, urls } = setup(OK);
    count(APP); count(LANG);
    expect(urls).toHaveLength(2);
  });

  it('the Improve switch at "0" stops level 2 and not level 1; any other value is on', () => {
    const off = setup({ ...OK, 'walkflow.usageImprove': '0' });
    off.count(LANG); off.count(APP);
    expect(off.urls).toEqual([`${BASE}/count?p=app.web.v0.7.2&t=app.web.v0.7.2&e=true`]);
    const on = setup({ ...OK, 'walkflow.usageImprove': '1', 'walkflow.usageErrors': '0' });
    on.count(LANG);
    expect(on.urls).toHaveLength(1);
  });

  it('a name stopped by its switch is sent when the switch is turned on and it is raised again in the same start', () => {
    const { count, urls, values } = setup({ ...OK, 'walkflow.usageImprove': '0' });
    count(LANG);
    delete values['walkflow.usageImprove'];
    count(LANG);
    expect(urls).toHaveLength(1);
  });

  it('never throws when the request or the log throws', () => {
    const count = createSender({ base: BASE, read: k => (k === 'walkflow.disclaimerAccepted' || k === 'walkflow.devMode' ? '1' : null), send: () => { throw new Error('blocked'); }, log: () => { throw new Error('no log'); } });
    expect(() => count(APP)).not.toThrow();
    expect(() => count(LANG)).not.toThrow();
  });

  it('never throws when reading the settings throws', () => {
    const count = createSender({ base: BASE, read: () => { throw new Error('storage'); }, send: () => { throw new Error('must not be reached'); }, log: () => undefined });
    expect(() => count(APP)).not.toThrow();
  });

  it('returns at once with a request that never settles: nothing is awaited', () => {
    const send = () => { void new Promise<void>(() => undefined); };
    const count = createSender({ base: BASE, read: k => (k === 'walkflow.disclaimerAccepted' ? '1' : null), send, log: () => undefined });
    const result: unknown = count(APP);
    expect(result).toBeUndefined();
  });

  it('writes one line "usage: <name>" per event sent in developer mode, and none otherwise', () => {
    const dev = setup({ ...OK, 'walkflow.devMode': '1' });
    dev.count(APP); dev.count(APP); dev.count(LANG);
    expect(dev.lines).toEqual(['usage: app.web.v0.7.2', 'usage: lang.en']);
    const plain = setup();
    plain.count(APP);
    expect(plain.lines).toEqual([]);
    const dropped = setup({ 'walkflow.devMode': '1' });
    dropped.count(APP);
    expect(dropped.lines).toEqual([]);
  });
});

describe('level 3: errors', () => {
  const ERR = errorName('connect-failed', '0.7.2')!;

  it('sends error.<kind>.v<version> with the Errors switch on', () => {
    const { count, urls } = setup();
    count(ERR);
    expect(urls).toEqual([`${BASE}/count?p=error.connect-failed.v0.7.2&t=error.connect-failed.v0.7.2&e=true`]);
  });

  it('sends no error.* request with the Errors switch off, while the other levels still go', () => {
    const { count, urls } = setup({ ...OK, 'walkflow.usageErrors': '0' });
    for (const k of ERROR_KINDS) count(errorName(k, '0.7.2'));
    count(APP);
    count(LANG);
    expect(urls.filter(u => u.includes('error.'))).toEqual([]);
    expect(urls).toHaveLength(2);
  });

  it('the Improve switch does not stop errors, and the Errors switch does not stop level 2', () => {
    const a = setup({ ...OK, 'walkflow.usageImprove': '0' });
    a.count(ERR); a.count(LANG);
    expect(a.urls).toHaveLength(1);
    const b = setup({ ...OK, 'walkflow.usageErrors': '0' });
    b.count(ERR); b.count(LANG);
    expect(b.urls).toHaveLength(1);
  });

  it('sends nothing before the first-start popup was accepted', () => {
    const { count, urls } = setup({});
    count(ERR);
    expect(urls).toEqual([]);
  });
});

describe('countUnexpected', () => {
  function rig() {
    const target = new EventTarget();
    const { count, urls } = setup();
    countUnexpected(target, kind => count(errorName(kind, '0.7.2')));
    return { target, urls };
  }
  const withText = (type: string, props: object) => Object.assign(new Event(type), props);

  it('turns an error event and an unhandled rejection into error.unexpected, once per start', () => {
    const { target, urls } = rig();
    target.dispatchEvent(withText('error', { message: 'x' }));
    target.dispatchEvent(withText('unhandledrejection', { reason: new Error('y') }));
    expect(urls).toEqual([`${BASE}/count?p=error.unexpected.v0.7.2&t=error.unexpected.v0.7.2&e=true`]);
  });

  it('carries nothing of the exception: no message, stack, path or email', () => {
    const { target, urls } = rig();
    const err = new Error('cannot read file C:\\Users\\max\\route.gpx for max@example.com');
    err.stack = 'Error: boom\n    at load (https://app.example/assets/index-abc.js:1:2)';
    target.dispatchEvent(withText('error', { message: err.message, filename: 'https://app.example/assets/index-abc.js', error: err }));
    target.dispatchEvent(withText('unhandledrejection', { reason: err }));
    expect(urls).toEqual([`${BASE}/count?p=error.unexpected.v0.7.2&t=error.unexpected.v0.7.2&e=true`]);
  });
});
