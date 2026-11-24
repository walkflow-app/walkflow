import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Country from '../../core/routes/country';
import type { Route } from '../../core/routes/routes';
import { packageFromRoute, serializePackage } from '../../core/routes/route-package';

const confirmDialog = vi.hoisted(() => vi.fn());
vi.mock('../components/dialogs', () => ({ confirmDialog }));
const countError = vi.hoisted(() => vi.fn());
vi.mock('../usage', () => ({ count: vi.fn(), countError }));
vi.mock('../../core/routes/country', async importOriginal => ({ ...(await importOriginal<typeof Country>()), countryAt: () => Promise.resolve('DE') }));

import { setupRouteImport } from './route-import';

const route: Route = {
  id: 'abc', name: 'Park loop', updated: 5, country: 'DE', defaultSpeed: 4,
  points: [{ lat: 52.5, lon: 13.4 }, { lat: 52.501, lon: 13.401 }, { lat: 52.502, lon: 13.4 }],
};
const file = { name: 'park.walkflow', text: serializePackage(packageFromRoute(route)) };

function setup(over: { put?: () => Promise<void>; list?: Route[] } = {}) {
  const put = vi.fn<(r: Route) => Promise<void>>(over.put ?? (() => Promise.resolve()));
  const host = {
    store: () => Promise.resolve({ put, list: () => Promise.resolve(over.list ?? []) } as never),
    setStatus: vi.fn(),
    added: vi.fn(() => Promise.resolve()),
  };
  return { ...setupRouteImport(host), put, host };
}

beforeEach(() => { confirmDialog.mockReset(); countError.mockClear(); vi.stubGlobal('location', { hash: '' }); });

describe('usage counts of errors', () => {
  it('store-add: a failing save and an unreadable package are counted, a success and a refusal are not', async () => {
    confirmDialog.mockResolvedValue(true);
    await setup({ put: () => Promise.reject(new Error('disk full')) }).takeFromStore(file, { storeFile: 'park.walkflow' });
    expect(countError.mock.calls).toEqual([['store-add']]);
    countError.mockClear();
    await setup().takeFromStore({ name: 'x.walkflow', text: 'not a package' }, { storeFile: 'x.walkflow' });
    expect(countError.mock.calls).toEqual([['store-add']]);
    countError.mockClear();
    await setup().takeFromStore(file, { storeFile: 'park.walkflow' });
    confirmDialog.mockResolvedValue(false);
    await setup().takeFromStore(file, { storeFile: 'park.walkflow' });
    expect(countError).not.toHaveBeenCalled();
  });

  it('file-read: an opened file that is unreadable or too large is counted, a readable one is not', async () => {
    const s = setup();
    await s.openPackage({ name: 'a.walkflow', error: 'unreadable' });
    await s.openPackage({ name: 'b.walkflow', error: 'tooLarge' });
    expect(countError.mock.calls).toEqual([['file-read'], ['file-read']]);
    countError.mockClear();
    confirmDialog.mockResolvedValue(false);
    await s.openPackage(file);
    expect(countError).not.toHaveBeenCalled();
  });

  it('file-read: a file that cannot be read is counted', async () => {
    const bad = { size: 1, name: 'a.gpx', text: () => Promise.reject(new Error('x')) } as unknown as File;
    await setup().importFile(bad);
    expect(countError.mock.calls).toEqual([['file-read']]);
  });
});

// The result says whether a NEW route was added: that is what the usage count `store.add` hangs on
describe('takeFromStore: true only for a new route', () => {
  it('a new route that the person confirms', async () => {
    confirmDialog.mockResolvedValue(true);
    const s = setup();
    await expect(s.takeFromStore(file, { storeFile: 'park.walkflow' })).resolves.toBe(true);
    expect(s.put).toHaveBeenCalledTimes(1);
    expect(s.put.mock.calls[0]![0]).toMatchObject({ storeFile: 'park.walkflow' });
  });

  it('an update of a route that is there already is saved but not counted', async () => {
    confirmDialog.mockResolvedValue(true);
    const s = setup({ list: [{ ...route, id: 'mine', revision: 1 }] });
    await expect(s.takeFromStore(file, { storeFile: 'park.walkflow', replace: 'mine' })).resolves.toBe(false);
    expect(s.put).toHaveBeenCalledTimes(1);
    expect(s.put.mock.calls[0]![0]).toMatchObject({ id: 'mine' });
  });

  it('a refusal saves nothing and counts nothing', async () => {
    confirmDialog.mockResolvedValue(false);
    const s = setup();
    await expect(s.takeFromStore(file, { storeFile: 'park.walkflow' })).resolves.toBe(false);
    expect(s.put).not.toHaveBeenCalled();
    expect(s.host.added).not.toHaveBeenCalled();
  });

  it('a failing save counts nothing', async () => {
    confirmDialog.mockResolvedValue(true);
    const s = setup({ put: () => Promise.reject(new Error('disk full')) });
    await expect(s.takeFromStore(file, { storeFile: 'park.walkflow' })).resolves.toBe(false);
    expect(s.host.added).not.toHaveBeenCalled();
  });

  it('a package that cannot be read is not asked about and not counted', async () => {
    const s = setup();
    await expect(s.takeFromStore({ name: 'x.walkflow', text: 'not a package' }, { storeFile: 'x.walkflow' })).resolves.toBe(false);
    expect(confirmDialog).not.toHaveBeenCalled();
    expect(s.put).not.toHaveBeenCalled();
  });
});
