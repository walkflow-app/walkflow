import { describe, expect, it } from 'vitest';
import { levelOf } from './events';
import { guardPart, treadmillName } from './treadmill';

describe('guardPart: what a treadmill reports about itself may become part of a name', () => {
  it('passes the strings of the real treadmill (#89: Sportstech sPad 500)', () => {
    expect(guardPart('FITHOME')).toBe('fithome');
    expect(guardPart('JJ-BT2-DL')).toBe('jj-bt2-dl');
  });

  it('normalises: lower case, spaces to -', () => {
    expect(guardPart('Some Maker')).toBe('some-maker');
    expect(guardPart('A.b_c+d')).toBe('a.b_c+d');
  });

  it('leaves out what looks like an identifier or is not a plain string', () => {
    const bad = [
      '', 'SN12345', '12345', '1234', 'AA:BB:CC:DD:EE:FF', 'aa-bb-cc-dd-ee-ff', 'AABBCCDDEEFF', 'abcdef',
      '123e4567-e89b-12d3-a456-426614174000', 'a@b', 'x/y', 'x'.repeat(33), 'ü', 'a&b=1', 'a?b', 'ab12-cd34-ef56', 'sn-1234-5678','a\nb', 'a#b', '%41',
    ];
    for (const s of bad) expect(guardPart(s), JSON.stringify(s)).toBeNull();
  });

  it('strips the NUL and space padding of Device Information strings at the ends', () => {
    expect(guardPart('FITHOME\0')).toBe('fithome');
    expect(guardPart('FITHOME\0\0\0')).toBe('fithome');
    expect(guardPart('FITHOME ')).toBe('fithome');
    expect(guardPart('  JJ-BT2-DL \0')).toBe('jj-bt2-dl');
    expect(guardPart('\0\0')).toBeNull();
    expect(guardPart('   ')).toBeNull();
    // Only the ends: a NUL inside is still turned down
    expect(guardPart('FIT\0HOME')).toBeNull();
  });

  it('leaves out a word made only of hex letters, on the safe side', () => {
    expect(guardPart('decade')).toBeNull();
    expect(guardPart('facade')).toBeNull();
  });

  it('passes the longest allowed string and short ones', () => {
    expect(guardPart('x'.repeat(32))).toBe('x'.repeat(32));
    expect(guardPart('a')).toBe('a');
    expect(guardPart('xy1234')).toBe('xy1234');
  });

  it('is not fooled by non-strings', () => {
    expect(guardPart(undefined)).toBeNull();
    expect(guardPart(null)).toBeNull();
  });
});

describe('treadmillName', () => {
  it('is tm.<maker>.<model>', () => {
    expect(treadmillName('ble', { manufacturer: 'FITHOME', model: 'JJ-BT2-DL' })).toBe('tm.fithome.jj-bt2-dl');
  });

  it('writes a part that is left out as unknown', () => {
    expect(treadmillName('ble', { manufacturer: 'FITHOME', model: 'SN12345' })).toBe('tm.fithome.unknown');
    expect(treadmillName('ble', { manufacturer: 'FITHOME' })).toBe('tm.fithome.unknown');
    expect(treadmillName('ble', { manufacturer: 'a@b', model: 'X1' })).toBe('tm.unknown.x1');
    expect(treadmillName('ble', { model: 'X1' })).toBe('tm.unknown.x1');
  });

  it('is tm.unknown when both are left out or none came', () => {
    expect(treadmillName('ble', {})).toBe('tm.unknown');
    expect(treadmillName('ble', { manufacturer: '12345678', model: 'a/b' })).toBe('tm.unknown');
  });

  it('is tm.unknown when the treadmill itself reports unknown', () => {
    expect(treadmillName('ble', { manufacturer: 'Unknown' })).toBe('tm.unknown');
    expect(treadmillName('ble', { manufacturer: 'UNKNOWN', model: 'unknown' })).toBe('tm.unknown');
    expect(treadmillName('ble', { manufacturer: 'unknown', model: 'SN12345' })).toBe('tm.unknown');
    expect(treadmillName('ble', { manufacturer: 'Unknown', model: 'X1' })).toBe('tm.unknown.x1');
  });

  it('is tm.demo for the demo, whatever the simulator says, without the guard', () => {
    expect(treadmillName('demo', { manufacturer: 'Walkflow' })).toBe('tm.demo');
    expect(treadmillName('demo', {})).toBe('tm.demo');
  });

  it('builds names the sender accepts (level 2)', () => {
    const names = [treadmillName('ble', { manufacturer: 'FITHOME', model: 'JJ-BT2-DL' }), treadmillName('ble', {}), treadmillName('demo', {}), treadmillName('ble', { manufacturer: 'x' }), treadmillName('ble', { manufacturer: 'Unknown' })];
    for (const n of names) expect(levelOf(n), n).toBe(2);
  });
});

describe('levelOf for treadmill names', () => {
  it('knows nothing that the guard would not have built', () => {
    for (const s of ['tm', 'tm.', 'tm.x', 'tm.SN12345.x', 'tm.a.SN12345', 'tm.a@b.c', 'tm.a/b.c', 'tm.a.b&p=1', 'tm.12345678.x', 'tm.unknown.unknown']) expect(levelOf(s), s).toBeNull();
  });
});
