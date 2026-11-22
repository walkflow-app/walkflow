import { TreadmillError } from 'ftms-treadmill';
import { describe, expect, it } from 'vitest';
import { ERROR_KINDS } from '../../core/usage/errors';
import { connectErrorKind, createLossTracker, noticeErrorKind, NOTICE_ERROR_KINDS, THROWN_ERROR_KINDS } from './error-kinds';

// The codes as the library declares them, read from its types: a code that is new there and not mapped fails here
const types = Object.values(import.meta.glob<string>('../../../node_modules/ftms-treadmill/dist/protocol/notice.d.ts', { query: '?raw', import: 'default', eager: true })).join('\n');
const noticeCodes = (() => {
  const notice = types.slice(types.indexOf('export type Notice ='));
  return [...notice.matchAll(/code: '([a-z-]+)'/g)].map(m => m[1]!);
})();
const consoleCodes = [...types.slice(0, types.indexOf('export type Notice =')).matchAll(/code: '([a-z-]+)'/g)].map(m => m[1]!);
const thrownCodes = (/export type TreadmillErrorCode = ([^;]+);/.exec(types)?.[1] ?? '').split('|').map(s => s.trim().replace(/'/g, ''));

describe('the library codes and the error kinds', () => {
  it('maps every notice code of the library (a new, unmapped one fails here)', () => {
    expect(noticeCodes.length).toBeGreaterThan(15);
    expect(Object.keys(NOTICE_ERROR_KINDS).sort()).toEqual([...new Set([...noticeCodes, ...consoleCodes])].sort());
  });

  it('maps every TreadmillErrorCode of the library', () => {
    expect(thrownCodes).toEqual(['no-gatt', 'not-connected', 'write-timeout']);
    expect(Object.keys(THROWN_ERROR_KINDS).sort()).toEqual([...thrownCodes].sort());
  });

  it('counts the failure notices of docs/USAGE.md and no other', () => {
    const counted = Object.entries(NOTICE_ERROR_KINDS).filter(([, k]) => k !== null).map(([c]) => c).sort();
    expect(counted).toEqual(['features-unreadable', 'speed-range-unreadable', 'speed-refused', 'start-speed-failed', 'write-failed']);
  });

  it('only maps to kinds that are listed', () => {
    const mapped = [...Object.values(NOTICE_ERROR_KINDS), ...Object.values(THROWN_ERROR_KINDS)].filter(k => k !== null);
    expect(mapped.filter(k => !(ERROR_KINDS as readonly string[]).includes(k))).toEqual([]);
  });

  it('gives a notice its kind, and nothing for information', () => {
    expect(noticeErrorKind({ code: 'write-failed' })).toBe('write-failed');
    expect(noticeErrorKind({ code: 'features' })).toBeNull();
  });
});

describe('connectErrorKind', () => {
  it('is the library code when the error carries one', () => {
    expect(connectErrorKind(new TreadmillError('no-gatt'))).toBe('no-gatt');
    expect(connectErrorKind(new TreadmillError('write-timeout'))).toBe('write-timeout');
  });

  it('is connect-failed for anything else, whatever the text says', () => {
    for (const e of [new Error('User cancelled the requestDevice() chooser.'), 'x', undefined, null, { code: 'no-gatt' }]) expect(connectErrorKind(e)).toBe('connect-failed');
  });
});

describe('the loss tracker', () => {
  it('a loss the person did not cause is a loss', () => {
    const t = createLossTracker();
    expect(t.lost()).toBe(true);
  });

  it("the person's own disconnect is not a loss, and only once", () => {
    const t = createLossTracker();
    t.personDisconnects();
    expect(t.lost()).toBe(false);
    expect(t.lost()).toBe(true);
  });
});
