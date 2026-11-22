// Where the anonymous usage counts go (docs/USAGE.md): a GoatCounter site, `https://<code>.goatcounter.com`, set when the app is
// built (WALKFLOW_USAGE). There is no default for any repository: a build without the setting, and a fork, send nothing. The
// content security policy and the request filter of the desktop app allow exactly `<base>/count` of this host and nothing else.

/** The address of the counting site, without a trailing slash, or null (nothing is sent). Only `https://<code>.goatcounter.com`. `repo` is not used: no repository has a default. */
export function resolveUsageBase(_repo: string, override = ''): string | null {
  if (!override) return null;
  let url: URL;
  try { url = new URL(override); } catch { return null; }
  const ok = url.protocol === 'https:' && /^[a-z0-9][a-z0-9-]{0,62}\.goatcounter\.com$/.test(url.hostname)
    && !url.port && !url.search && !url.hash && !url.username && !url.password && url.pathname === '/';
  return ok ? url.origin : null;
}

/** The address of the one request that counts `name` (a name built by core/usage/events.ts) */
export const usageCountUrl = (base: string, name: string): string => `${base}/count?p=${encodeURIComponent(name)}&t=${encodeURIComponent(name)}&e=true`;
