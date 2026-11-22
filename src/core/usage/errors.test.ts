import { describe, expect, it } from 'vitest';
import { ERROR_KINDS, errorName, isErrorName } from './errors';
import { levelOf } from './events';

describe('errorName (level 3)', () => {
  it('is error.<kind>.v<version>', () => {
    expect(errorName('connect-failed', '0.7.2')).toBe('error.connect-failed.v0.7.2');
    expect(errorName('unexpected', '10.0.1')).toBe('error.unexpected.v10.0.1');
  });

  it('builds a name for every kind, each with level 3', () => {
    for (const k of ERROR_KINDS) expect(levelOf(errorName(k, '0.7.2')!), k).toBe(3);
  });

  it('builds nothing for a version that is not x.y.z', () => {
    for (const v of ['', '0.7', '0.7.2-beta.1', 'v0.7.2', '0.7.2&x=1', '0.7.2\n']) expect(errorName('write-failed', v), v).toBeNull();
  });

  it('builds nothing for a kind that is not listed', () => {
    expect(errorName('Error: boom at C:\\x' as never, '0.7.2')).toBeNull();
  });

  it('knows no outside string', () => {
    for (const s of ['error.connect-failed', 'error.other.v0.7.2', 'error.connect-failed.v0.7', 'error.connect-failed.v0.7.2.x', 'x\nerror.unexpected.v0.7.2']) {
      expect(isErrorName(s), s).toBe(false);
      expect(levelOf(s), s).toBeNull();
    }
  });
});
