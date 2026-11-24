// The names of the anonymous usage counts (docs/USAGE.md). An event is one name built here from fixed parts; no event carries
// a free text, a measured number or an ID. Pure: the sender is ui/usage.ts, the address platform/usage-url.ts. Everything that
// can be sent is listed in FIXED_NAMES and PATTERNS, and docs/USAGE.md lists the same (a test compares them).

import { STORE_FILE_NAME } from '../routes/routes';

/** 1 Used (always, after the first-start popup), 2 Improve (switch), 3 Errors (switch; comes with the error codes) */
export type UsageLevel = 1 | 2 | 3;

/** Settings keys of the two switches (through ui/store.ts): absent means on, "0" means off. The only thing stored for the counts. */
export const USAGE_IMPROVE_KEY = 'walkflow.usageImprove';
export const USAGE_ERRORS_KEY = 'walkflow.usageErrors';

/** Is a switch on, from what was stored: only the exact value "0" is off */
export const usageSwitchOn = (raw: string | null): boolean => raw !== '0';

const PLATFORMS = ['web', 'win', 'mac', 'linux'] as const;
type UsagePlatform = (typeof PLATFORMS)[number];
const LANGUAGES = ['en', 'de', 'fr', 'uk'] as const;

/** Level 2 names of the views, editors, imports, exports and the store that are written out in full */
const FEATURE_NAMES = [
  'view.training', 'view.workouts', 'view.routes', 'view.history',
  'workout.interval', 'workout.weekplan', 'workout.import',
  'route.own', 'route.gpx', 'route.map-on',
  'history.csv', 'history.tcx',
  'store.open', 'store.add',
] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Names that are written out in full */
export const FIXED_NAMES: readonly string[] = [...LANGUAGES.map(l => `lang.${l}`), ...FEATURE_NAMES];

/** Names with a part the code fills in, as they are written in docs/USAGE.md */
export const PATTERNS: readonly string[] = ['app.<web|win|mac|linux>.v<x.y.z>', 'store.route.<name>'];

/** A name built here; the only thing the sender takes. The brand keeps an outside string from being passed by accident. */
export type UsageName = string & { readonly __usageName: true };

const VERSION = /^\d+\.\d+\.\d+$/;
const APP_NAME = new RegExp(`^app\\.(${PLATFORMS.join('|')})\\.v\\d+\\.\\d+\\.\\d+$`);
const LANG_NAME = new RegExp(`^lang\\.(${LANGUAGES.join('|')})$`);

const DESKTOP_PLATFORMS = new Map<string, UsagePlatform>([['win32', 'win'], ['darwin', 'mac'], ['linux', 'linux']]);

/**
 * Level 1: the app was started. `desktopPlatform` is the desktop bridge's `platform` (undefined in the web build). Any other
 * platform, or a version that is not x.y.z (a pre-release), builds nothing.
 */
export function appStartName(desktopPlatform: string | undefined, version: string): UsageName | null {
  const platform = desktopPlatform === undefined ? 'web' : DESKTOP_PLATFORMS.get(desktopPlatform);
  if (!platform || !VERSION.test(version)) return null;
  return `app.${platform}.v${version}` as UsageName;
}

/** Level 2: the language of the texts at start */
export function langName(lang: string): UsageName | null {
  return (LANGUAGES as readonly string[]).includes(lang) ? (`lang.${lang}` as UsageName) : null;
}

/** Level 2: a function was used. Only the names listed in FEATURE_NAMES can be built. */
export function featureName(name: FeatureName): UsageName {
  return name as UsageName;
}

/** Level 2: a view was opened; `community` and anything else builds nothing */
export function viewName(view: string): UsageName | null {
  const name = `view.${view}`;
  return (FEATURE_NAMES as readonly string[]).includes(name) ? (name as UsageName) : null;
}

const STORE_EXT = '.walkflow';
const STORE_ROUTE_NAME = /^store\.route\.[a-z0-9][a-z0-9._-]{0,80}$/;

/**
 * Level 2: a route of the store was added. `file` must be one of `indexFiles`, the file names of the loaded index; anything
 * else (a route a person made, a saved route's storeFile) builds nothing.
 */
export function storeRouteName(file: string, indexFiles: readonly string[]): UsageName | null {
  if (!indexFiles.includes(file)) return null;
  if (!STORE_FILE_NAME.test(file)) return null;
  return `store.route.${file.slice(0, -STORE_EXT.length)}` as UsageName;
}

/** The level of a name, or null for anything that is not a name built here (the sender sends nothing for it) */
export function levelOf(name: string): UsageLevel | null {
  if (APP_NAME.test(name)) return 1;
  if (LANG_NAME.test(name) || (FEATURE_NAMES as readonly string[]).includes(name) || STORE_ROUTE_NAME.test(name)) return 2;
  return null;
}
