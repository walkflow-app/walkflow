// The release gate (meta spec 0002): agents may merge changes that reach the belt, so a release waits until the maintainer
// has checked them on a treadmill. Every pull request merged since the last release that touches a safety path (see
// agent-pipeline.mjs) or has the label needs-hardware needs the maintainer's comment "/hardware-ok" on it, or one
// "/hardware-ok" on the release pull request for all of them. Run by the release skill before the release pull request is
// merged, and by release.yml before anything is built.
//
//   node scripts/release-gate.mjs <ref> [<release pull request>]
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classify } from './agent-pipeline.mjs';

const PEOPLE = new Set(['OWNER', 'MEMBER']);

/** A comment that confirms the hardware checks: "/hardware-ok" by a person of the organisation, not by a bot */
export const confirms = c => c.userType === 'User' && PEOPLE.has(c.association) && /^\/hardware-ok\b/m.test(c.body ?? '');

/** The pull requests that still wait for the hardware checks. prs: [{ number, title, files, labels, comments }] */
export function releaseGate(prs, releaseComments = []) {
  if (releaseComments.some(confirms)) return [];
  return prs.filter(p => (classify(p.files).safety || p.labels.includes('needs-hardware')) && !p.comments.some(confirms));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [ref = 'HEAD', releasePr] = process.argv.slice(2);
  const repo = process.env.GITHUB_REPOSITORY ?? 'walkflow-app/walkflow';
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
  const pages = path => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', path], { encoding: 'utf8', maxBuffer: 64 << 20 })).flat();
  const comments = n => pages(`repos/${repo}/issues/${n}/comments?per_page=100`)
    .map(c => ({ userType: c.user?.type, association: c.author_association, body: c.body }));
  // The last release before <ref> (its tag itself when <ref> is the new tag)
  const last = git('describe', '--tags', '--abbrev=0', '--match', 'v*', `${ref}^`);
  const numbers = git('log', '--format=%s', `${last}..${ref}`).split('\n').map(s => /\(#(\d+)\)$/.exec(s)?.[1]).filter(Boolean);
  const prs = numbers.map(n => {
    const p = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/pulls/${n}`], { encoding: 'utf8' }));
    return { number: n, title: p.title, labels: p.labels.map(l => l.name), files: pages(`repos/${repo}/pulls/${n}/files?per_page=100`), comments: comments(n) };
  });
  // The release pull request: given, or the one that made <ref>
  const rel = releasePr ?? JSON.parse(execFileSync('gh', ['api', `repos/${repo}/commits/${git('rev-parse', ref)}/pulls`], { encoding: 'utf8' }))[0]?.number?.toString();
  const open = releaseGate(prs.filter(p => p.number !== rel), rel ? comments(rel) : []);
  console.log(`Since ${last}: ${prs.length} pull requests, ${open.length} waiting for the hardware checks.`);
  for (const p of open) console.log(`::error::#${p.number} ${p.title}: run its checks in HARDWARE-TESTS.md on a treadmill, then comment "/hardware-ok" on it (or once on the release pull request for all).`);
  process.exitCode = open.length ? 1 : 0;
}
