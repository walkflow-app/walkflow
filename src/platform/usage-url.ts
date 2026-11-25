// Where the anonymous usage counts go (docs/USAGE.md): a GoatCounter site, `https://<code>.goatcounter.com`, set when the app is
// built (WALKFLOW_USAGE), or, for the official repository only, the default below. A fork and a build from source send nothing. The
// content security policy and the request filter of the desktop app allow exactly `<base>/count` of this host and nothing else.

/** The repository the official builds are made from: the only one with a default counting site */
const OFFICIAL_REPO = 'walkflow-app/walkflow';
/** The official counting site (confirmed by the maintainer, issue #85) */
const OFFICIAL_USAGE_BASE = 'https://walkflow.goatcounter.com';

/** The address of the counting site, without a trailing slash, or null (nothing is sent). Only `https://<code>.goatcounter.com`. Without `override`, only the official repository has one. */
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
