// Where the anonymous usage counts go (docs/USAGE.md): a GoatCounter site, `https://<code>.goatcounter.com`, set when the app is
// built (WALKFLOW_USAGE). The only default is the official repository's own site; a build without the setting for any other
// repository (a fork, a build from source, no repository at all) sends nothing. The
// content security policy and the request filter of the desktop app allow exactly `<base>/count` of this host and nothing else.

/** The repository whose builds count to the official site when nothing else is set (like the store's default in store-url.ts) */
const OFFICIAL_REPO = 'walkflow-app/walkflow';
/** The official counting site (the GoatCounter account `walkflow`) */
const OFFICIAL_USAGE_BASE = 'https://walkflow.goatcounter.com';

/**
 * The address of the counting site, without a trailing slash, or null (nothing is sent). Only `https://<code>.goatcounter.com`.
 * `override` (WALKFLOW_USAGE) wins and must pass the host check; an invalid one gives null, never the default. Without one, only
 * the official repository gets the official site.
 */
export function resolveUsageBase(repo: string, override = ''): string | null {
  if (!override) return repo === OFFICIAL_REPO ? OFFICIAL_USAGE_BASE : null;
  let url: URL;
  try { url = new URL(override); } catch { return null; }
  const ok = url.protocol === 'https:' && /^[a-z0-9][a-z0-9-]{0,62}\.goatcounter\.com$/.test(url.hostname)
    && !url.port && !url.search && !url.hash && !url.username && !url.password && url.pathname === '/';
  return ok ? url.origin : null;
}

/** The address of the one request that counts `name` (a name built by core/usage/events.ts) */
export const usageCountUrl = (base: string, name: string): string => `${base}/count?p=${encodeURIComponent(name)}&t=${encodeURIComponent(name)}&e=true`;
