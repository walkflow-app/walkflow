// The paths the process distinguishes, in one place: read by the agent pipeline, the safety gate and the choice of the reviewing
// pipeline. Change a list here and nowhere else (walkflow#71); CODEOWNERS is kept by hand.

/** Belt code: what can change what is sent to the treadmill, or what the person is warned about. Test first, reviewed, label needs-hardware, one check on a treadmill before the release. The pipeline merges it. `src/main.ts` wires the
 *  whole app and so counts until the belt's wiring is moved out of it. */
export const SAFETY = [
  /^src\/core\/safety\//, /^src\/ui\/live\//, /^src\/core\/training\//, /^src\/platform\/bt-devices/, /^src\/ui\/background\.ts$/,
  /^src\/main\.ts$/, /^electron\//,
];

/** Trust-boundary code: what talks to others or shares data. Two reviews by two models like belt code, but no treadmill session.
 *  The pipeline merges it. */
export const TRUST = [/^src\/net\//, /^src\/core\/share\//];

/** The same lists for a shell: `node scripts/paths.mjs safety|trust` prints one extended regular expression. */
export const asRegExp = list => list.map(p => p.source.replaceAll('\\/', '/')).join('|');

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const lists = { safety: SAFETY, trust: TRUST, careful: [...SAFETY, ...TRUST] };
  const list = lists[process.argv[2]];
  if (!list) { console.error('usage: node scripts/paths.mjs safety|trust|careful'); process.exit(2); }
  console.log(asRegExp(list));
}
