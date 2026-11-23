import { afterEach, describe, expect, it, vi } from 'vitest';

const count = vi.hoisted(() => vi.fn());
vi.mock('./usage', () => ({ count }));

import { countView } from './views-count';

describe('countView', () => {
  afterEach(() => count.mockClear());

  it('makes one call with the name of the view', () => {
    countView('history');
    expect(count.mock.calls).toEqual([['view.history']]);
  });

  it('calls with nothing for community, which has no name', () => {
    countView('community');
    expect(count.mock.calls).toEqual([[null]]);
  });
});
