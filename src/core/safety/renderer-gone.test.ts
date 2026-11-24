import { describe, expect, it } from 'vitest';
import { warnWhenRendererGone } from './renderer-gone';

describe('the desktop window crashed (#49 F)', () => {
  it('warns for every end that was not a clean exit: the belt may still run and nothing can stop it from the app', () => {
    for (const reason of ['crashed', 'oom', 'killed', 'abnormal-exit', 'launch-failed', 'integrity-failure']) {
      expect(warnWhenRendererGone(reason)).toBe(true);
    }
  });

  it('says nothing for a clean exit', () => {
    expect(warnWhenRendererGone('clean-exit')).toBe(false);
  });
});
