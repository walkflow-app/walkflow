import { beforeEach, describe, expect, it, vi } from 'vitest';

const countError = vi.hoisted(() => vi.fn());
vi.mock('../usage', () => ({ count: vi.fn(), countError }));
vi.mock('../components/dialogs', () => ({ confirmDialog: vi.fn(() => Promise.resolve(false)) }));

import { setupWorkoutImport } from './workout-import';

const setup = () => setupWorkoutImport({ store: () => Promise.reject(new Error('unused')), setStatus: vi.fn(), added: () => Promise.resolve() });

describe('usage counts of errors (file-read)', () => {
  beforeEach(() => { countError.mockClear(); vi.stubGlobal('location', { hash: '' }); });

  it('an opened file that is unreadable or too large is counted', async () => {
    const s = setup();
    await s.openPackage({ name: 'a.walkflow', error: 'unreadable' });
    await s.openPackage({ name: 'b.walkflow', error: 'tooLarge' });
    expect(countError.mock.calls).toEqual([['file-read'], ['file-read']]);
  });

  it('a file that cannot be read is counted', async () => {
    await setup().importFile({ size: 1, name: 'a.walkflow', text: () => Promise.reject(new Error('x')) } as unknown as File);
    expect(countError.mock.calls).toEqual([['file-read']]);
  });

  it('a file that is read (even if it is not a workout) is not counted', async () => {
    await setup().importFile({ size: 1, name: 'a.walkflow', text: () => Promise.resolve('nope') } as unknown as File);
    expect(countError).not.toHaveBeenCalled();
  });
});
