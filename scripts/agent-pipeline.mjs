// The agent pipeline (meta spec 0002, CONTRIBUTING.md → Agents on GitHub): agents review a pull request, fix what the review
// found, and merge it, without the maintainer. This file decides; the workflows only run it. Everything that decides runs
// from main (agent-pipeline.yml, the second jobs of agent-review.yml and agent-fix.yml), never from the pull request, so a
// pull request cannot change the rules it is judged by.
//
//   node scripts/agent-pipeline.mjs models <pr>                  which models review (plan job of agent-review.yml)
//   node scripts/agent-pipeline.mjs submit-review <pr> <dir>     the verdicts in <dir>/*.md → one review each
//   node scripts/agent-pipeline.mjs sweep                        decide and act for every open pull request
//   node scripts/agent-pipeline.mjs check-fix <pr> <sha> <patch> may this fix be pushed? (agent-fix.yml)
//
// Off unless the repository variable AGENT_PIPELINE is "on"; then reviews are a comment, as before.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WRITER = 'walkflow-writer[bot]';
export const REVIEWER = 'walkflow-reviewer[bot]';
export const REQUIRED_CHECKS = ['test', 'safety-gate'];
export const LIMITS = { reviews: 4, mergesPerDay: 5, unreviewedLines: 30, staleHours: 6 };
const MEMBERS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const VERDICTS = ['OK', 'OK with remarks', 'changes needed', 'blocking'];

/** What reaches the belt: reviewed by two models, label needs-hardware, held for the hardware checks before a release */
export const SAFETY = [/^src\/core\/safety\//, /^src\/ui\/live\//, /^src\/core\/training\//, /^src\/platform\/bt-devices/, /^src\/main\.ts$/];
/** Never merged by an agent: the rules, the gates, the pipeline itself, dependencies, and what CODEOWNERS keeps for a person */
export const PROTECTED = [
  /^\.github\//, /^\.claude\//, /(^|\/)CLAUDE\.md$/, /^HARDWARE-TESTS\.md$/, /^scripts\//, /^tests\/architecture\.test\.ts$/,
  /^package(-lock)?\.json$/, /^\.oxlintrc\.json$/, /^knip\.json$/, /^tsconfig[^/]*\.json$/, /^vite\.config\.ts$/, /^vitest\.config/,
  /^release-please-config\.json$/, /^\.release-please-manifest\.json$/, /^electron-builder\.config\.cjs$/,
  /^electron\//, /^public\/legal\//, /^src\/net\//, /^src\/core\/share\//,
];
const TEST = /\.test\.(ts|mjs)$/;
const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|safety)(\([^)]+\))?: \S/;
/** The GitHub API lists at most this many files of a pull request; more and we cannot know what it changes */
const MAX_FILES = 3000;

// ---------- Pure decisions (tests/agent-pipeline.test.ts) ----------

const names = f => [f.filename, f.previous_filename].filter(Boolean);

/** The files of a diff: { safety, protected: [...], removedTests: [...], lines } */
export function classify(files) {
  const all = files.flatMap(names);
  return {
    safety: all.some(n => SAFETY.some(p => p.test(n))),
    protected: files.length >= MAX_FILES ? ['(too many files to check)'] : [...new Set(all.filter(n => PROTECTED.some(p => p.test(n))))],
    removedTests: files.filter(f => f.status === 'removed' && TEST.test(f.filename)).map(f => f.filename),
    lines: files.reduce((s, f) => s + (f.additions ?? 0) + (f.deletions ?? 0), 0),
  };
}

/** The verdict a review summary ends with ("Agent review: …"), or null */
export function parseVerdict(text) {
  const all = [...String(text).matchAll(/Agent review:\s*\**\s*(OK with remarks|OK|changes needed|blocking)\b/gi)];
  const last = all.at(-1)?.[1]?.toLowerCase();
  return VERDICTS.find(v => v.toLowerCase() === last) ?? null;
}

export const reviewEvent = verdict => (verdict === 'OK' ? 'APPROVE' : verdict === 'OK with remarks' ? 'COMMENT' : 'REQUEST_CHANGES');

const MARK = /<!-- (agent-review|agent-fix) (\{.*?\}) -->/;
export const marker = (kind, data) => `<!-- ${kind} ${JSON.stringify(data)} -->`;
export function readMarker(kind, body) {
  const m = MARK.exec(String(body ?? ''));
  if (!m || m[1] !== kind) return null;
  try { return JSON.parse(m[2]); } catch { return null; }
}

/** Texts the pipeline posts never call claude.yml */
export const quiet = text => String(text).replace(/@claude/gi, 'claude');

const worst = verdicts => verdicts.reduce((a, v) => (VERDICTS.indexOf(v) > VERDICTS.indexOf(a) ? v : a), 'OK');

/**
 * What to do next with one pull request. `s` is what the sweep read from GitHub (see readState). Returns
 * { action: 'skip' | 'wait' | 'hold' | 'fix' | 'update' | 'merge', reason, mode?, sha?, safety, addLabels }.
 */
export function decide(s) {
  const { pr } = s;
  const files = classify(s.files);
  const safety = files.safety;
  const out = (action, reason, extra = {}) => ({ action, reason, safety, addLabels: safety && !pr.labels.includes('needs-hardware') ? ['needs-hardware'] : [], ...extra });

  if (!s.pipeline) return out('skip', 'AGENT_PIPELINE is not on');
  if (pr.draft) return out('skip', 'draft');
  if (pr.headRepo !== pr.repo) return out('skip', 'from a fork');
  if (/^(release-please--|dependabot\/)/.test(pr.headRef)) return out('skip', 'release or Dependabot pull request');
  if (pr.labels.includes('hold') || pr.labels.includes('needs-maintainer')) return out('skip', 'labelled for the maintainer');
  if (pr.author.type === 'Bot' && pr.author.login !== WRITER) return out('skip', `opened by ${pr.author.login}`);
  if (pr.author.type !== 'Bot' && !MEMBERS.has(pr.authorAssociation)) return out('skip', 'author outside the organisation');
  if (pr.author.login === WRITER && s.issueAuthors.some(a => !MEMBERS.has(a)))
    return out('hold', 'it closes an issue written by someone outside the organisation');
  if (files.protected.length) return out('hold', `it changes files only the maintainer merges: ${files.protected.join(', ')}`);
  if (s.running.review || s.running.fix) return out('wait', 'a review or a fix is running');
  if (s.humanChangesRequested) return out('wait', 'a person requested changes');

  const reviews = s.reviews.filter(r => r.user === REVIEWER).map(r => ({ ...r, mark: readMarker('agent-review', r.body) })).filter(r => r.mark);
  const counted = new Set(reviews.filter(r => !s.holdResetAt || r.submittedAt > s.holdResetAt).map(r => r.commitId)).size;
  const fixed = (sha, mode) => s.comments.some(c => c.user === WRITER && readMarker('agent-fix', c.body)?.sha === sha && readMarker('agent-fix', c.body)?.mode === mode);

  if (s.mergeable === 'CONFLICTING')
    return fixed(pr.headSha, 'conflict') ? out('hold', 'the conflict with main is still there after one try')
      : counted >= LIMITS.reviews ? out('hold', `${LIMITS.reviews} reviews and still not done`)
      : out('fix', 'conflict with main', { mode: 'conflict', sha: pr.headSha });

  // The review of the head commit: for a safety change one by each model
  const onHead = reviews.filter(r => r.commitId === pr.headSha);
  const models = new Set(onHead.map(r => r.mark.model));
  const complete = safety ? models.has('opus') && models.has('sonnet') : onHead.length > 0;
  let reviewedTitle;
  if (complete) {
    const verdict = worst(onHead.map(r => r.mark.verdict));
    reviewedTitle = onHead.at(-1).mark.title;
    if (verdict === 'blocking') return out('hold', 'the review says blocking');
    if (verdict === 'changes needed') {
      if (fixed(pr.headSha, 'remarks')) return out('hold', 'the review asks for changes and the fix changed nothing');
      if (counted >= LIMITS.reviews) return out('hold', `${LIMITS.reviews} reviews and still changes needed`);
      return out('fix', 'the review asks for changes', { mode: 'remarks', sha: pr.headSha });
    }
    if (verdict === 'OK with remarks' && !fixed(pr.headSha, 'remarks'))
      return out('fix', 'the review has remarks', { mode: 'remarks', sha: pr.headSha });
  } else {
    // A fix of "OK with remarks" after the review: merged without another review only if it is small and harmless
    const last = reviews.findLast(r => r.commitId !== pr.headSha);
    const since = s.sinceReviewed;
    const small = since && last && since.base === last.commitId && since.status === 'ahead' && !safety && last.mark.verdict === 'OK with remarks'
      && fixed(last.commitId, 'remarks') && (() => {
        const c = classify(since.files);
        return !c.safety && !c.protected.length && !c.removedTests.length && c.lines <= LIMITS.unreviewedLines;
      })();
    if (!small) {
      if (counted >= LIMITS.reviews) return out('hold', `${LIMITS.reviews} reviews and still not done`);
      return s.headAgeHours > LIMITS.staleHours ? out('hold', `no complete review of ${pr.headSha.slice(0, 7)} after ${LIMITS.staleHours} hours`)
        : out('wait', 'waiting for the review of the head commit');
    }
    reviewedTitle = last.mark.title;
  }

  // Ready but for the checks, main, and the title
  const failed = REQUIRED_CHECKS.filter(n => ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale'].includes(s.checks[n] ?? ''));
  if (failed.length)
    return fixed(pr.headSha, 'checks') ? out('hold', `${failed.join(', ')} still fails after one fix`)
      : out('fix', `${failed.join(', ')} fails`, { mode: 'checks', sha: pr.headSha });
  const pending = REQUIRED_CHECKS.filter(n => s.checks[n] !== 'success');
  if (pending.length)
    return s.headAgeHours > LIMITS.staleHours ? out('hold', `${pending.join(', ')} did not finish in ${LIMITS.staleHours} hours`) : out('wait', `waiting for ${pending.join(', ')}`);
  if (safety && s.behindBy > 0) return out('update', 'a safety change is merged only on top of the current main', { sha: pr.headSha });
  if (s.mergeable !== 'MERGEABLE') return out('wait', `GitHub says ${s.mergeable}`);
  if (!CONVENTIONAL.test(pr.title)) return out('hold', 'the title is not a Conventional Commit (a breaking "!" is merged by the maintainer)');
  if (reviewedTitle !== pr.title) return out('hold', 'the title changed after the review');
  if (s.mergedToday >= LIMITS.mergesPerDay) return out('wait', `${LIMITS.mergesPerDay} agent merges today`);
  return out('merge', 'reviewed, green, up to date', { sha: pr.headSha });
}

/** The models that review a pull request: safety changes by both, otherwise the one review-model.sh chose */
export const reviewModels = (files, chosen, pipeline) => (pipeline && classify(files).safety ? ['opus', 'sonnet'] : [chosen]);

/** May the patch of a fix be pushed? It must not reach a protected file */
export function checkFix(paths) {
  const c = classify(paths.map(filename => ({ filename })));
  return c.protected.length ? { ok: false, reason: `the fix would change ${c.protected.join(', ')}` } : { ok: true };
}

// ---------- GitHub ----------

const REPO = process.env.GITHUB_REPOSITORY ?? 'walkflow-app/walkflow';
const gh = (args, { token, input } = {}) => execFileSync('gh', args, {
  encoding: 'utf8', input, maxBuffer: 64 << 20, env: { ...process.env, ...(token ? { GH_TOKEN: token } : {}) },
});
const api = (path, opts) => JSON.parse(gh(['api', path], opts) || 'null');
const pages = path => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

function readState(n, pipeline) {
  const p = api(`repos/${REPO}/pulls/${n}`);
  const head = p.head.sha;
  const q = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){mergeable closingIssuesReferences(first:20){nodes{authorAssociation}}}}}`;
  const [owner, name] = REPO.split('/');
  const g = JSON.parse(gh(['api', 'graphql', '-f', `query=${q}`, '-f', `o=${owner}`, '-f', `r=${name}`, '-F', `n=${n}`])).data.repository.pullRequest;
  const reviews = pages(`repos/${REPO}/pulls/${n}/reviews?per_page=100`).map(r => ({
    user: r.user?.login, userType: r.user?.type, state: r.state, commitId: r.commit_id, body: r.body, submittedAt: r.submitted_at,
  }));
  const latestHuman = new Map();
  for (const r of reviews) if (r.userType === 'User' && r.state !== 'COMMENTED') latestHuman.set(r.user, r.state);
  const runs = pages(`repos/${REPO}/actions/runs?head_sha=${head}&per_page=100`).flatMap(x => x.workflow_runs ?? x)
    .concat(pages(`repos/${REPO}/actions/workflows/agent-fix.yml/runs?per_page=50`).flatMap(x => x.workflow_runs ?? x));
  const active = r => ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(r.status);
  const checks = {};
  for (const c of pages(`repos/${REPO}/commits/${head}/check-runs?per_page=100`).flatMap(x => x.check_runs ?? x))
    if (REQUIRED_CHECKS.includes(c.name)) checks[c.name] = c.status === 'completed' ? c.conclusion : 'pending';
  const events = pages(`repos/${REPO}/issues/${n}/events?per_page=100`);
  const reset = events.findLast(e => e.event === 'unlabeled' && e.label?.name === 'needs-maintainer')?.created_at ?? null;
  const lastReviewed = reviews.findLast(r => r.user === REVIEWER && r.commitId !== head)?.commitId;
  let sinceReviewed = null;
  if (lastReviewed) {
    try {
      const c = api(`repos/${REPO}/compare/${lastReviewed}...${head}`);
      sinceReviewed = { base: lastReviewed, status: c.status, files: c.files ?? [] };
    } catch { /* the reviewed commit is gone (force-push): no shortcut */ }
  }
  const today = new Date().toISOString().slice(0, 10);
  const merged = JSON.parse(gh(['api', '-X', 'GET', 'search/issues', '-f', `q=repo:${REPO} is:pr is:merged merged:>=${today}`])).items ?? [];
  const mergedToday = merged.filter(i => api(`repos/${REPO}/pulls/${i.number}`).merged_by?.login === WRITER).length;
  const commit = api(`repos/${REPO}/commits/${head}`);
  return {
    pipeline,
    pr: {
      number: n, draft: p.draft, headRef: p.head.ref, headSha: head, headRepo: p.head.repo?.full_name, repo: REPO,
      author: { login: p.user.login, type: p.user.type }, authorAssociation: p.author_association, title: p.title,
      labels: p.labels.map(l => l.name),
    },
    files: pages(`repos/${REPO}/pulls/${n}/files?per_page=100`),
    issueAuthors: g.closingIssuesReferences.nodes.map(i => i.authorAssociation),
    reviews,
    comments: pages(`repos/${REPO}/issues/${n}/comments?per_page=100`).map(c => ({ user: c.user?.login, body: c.body })),
    checks,
    mergeable: g.mergeable,
    behindBy: api(`repos/${REPO}/compare/${p.base.ref}...${head}`).behind_by,
    sinceReviewed,
    running: {
      review: runs.some(r => r.name === 'Agent review' && r.head_sha === head && active(r)),
      fix: runs.some(r => r.path?.endsWith('agent-fix.yml') && active(r) && r.display_title?.startsWith(`Agent fix #${n} `)),
    },
    humanChangesRequested: [...latestHuman.values()].includes('CHANGES_REQUESTED'),
    holdResetAt: reset,
    mergedToday,
    headAgeHours: (Date.now() - Date.parse(commit.commit.committer.date)) / 3.6e6,
  };
}

function act(n, d, s, writer) {
  const say = text => gh(['api', `repos/${REPO}/issues/${n}/comments`, '-f', `body=${quiet(text)}`], { token: writer });
  if (d.addLabels.length) gh(['api', `repos/${REPO}/issues/${n}/labels`, ...d.addLabels.flatMap(l => ['-f', `labels[]=${l}`])], { token: writer });
  if (d.action === 'hold') {
    gh(['api', `repos/${REPO}/issues/${n}/labels`, '-f', 'labels[]=needs-maintainer'], { token: writer });
    say(`Agent pipeline: this pull request waits for the maintainer: ${d.reason}. Remove the label \`needs-maintainer\` to hand it back to the agents.`);
  } else if (d.action === 'update') {
    gh(['api', '-X', 'PUT', `repos/${REPO}/pulls/${n}/update-branch`, '-f', `expected_head_sha=${d.sha}`], { token: writer });
  } else if (d.action === 'fix') {
    // Started with the workflow token: workflow_dispatch is the one event it may start
    gh(['workflow', 'run', 'agent-fix.yml', '-R', REPO, '-f', `pr=${n}`, '-f', `mode=${d.mode}`, '-f', `sha=${d.sha}`, '-f', `model=${d.safety ? 'opus' : 'sonnet'}`]);
  } else if (d.action === 'merge') {
    try {
      gh(['api', '-X', 'PUT', `repos/${REPO}/pulls/${n}/merge`, '-f', 'merge_method=squash', '-f', `sha=${d.sha}`,
        '-f', `commit_title=${s.pr.title} (#${n})`, '-f', `commit_message=Reviewed and merged by the agent pipeline at ${d.sha.slice(0, 7)}.`], { token: writer });
    } catch (e) {
      // Merged in the meantime, or the head moved: the next sweep sees it
      console.log(`  merge refused: ${String(e.stderr ?? e.message).trim()}`);
    }
  }
}

function sweep() {
  const pipeline = process.env.AGENT_PIPELINE === 'on';
  const writer = process.env.WRITER_TOKEN;
  if (!pipeline) { console.log('AGENT_PIPELINE is not on: nothing to do'); return; }
  if (!writer) throw new Error('WRITER_TOKEN is missing');
  for (const { number } of pages(`repos/${REPO}/pulls?state=open&per_page=100`)) {
    try {
      const s = readState(number, pipeline);
      const d = decide(s);
      console.log(`#${number}: ${d.action} (${d.reason})`);
      act(number, d, s, writer);
    } catch (e) {
      console.log(`::warning::#${number}: ${String(e.stderr ?? e.message).trim()}`);
    }
  }
}

function submitReview(n, dir) {
  const pipeline = process.env.AGENT_PIPELINE === 'on';
  const sha = process.env.HEAD_SHA;
  const title = process.env.TITLE ?? '';
  const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort();
  if (!files.length) throw new Error('No review summary was written; comment "/agent review" or push again.');
  const reviews = files.map(f => {
    const text = quiet(readFileSync(join(dir, f), 'utf8')).trim();
    const verdict = parseVerdict(text);
    if (!verdict) throw new Error(`${f} does not end with "Agent review: <verdict>"`);
    return { model: f.replace(/\.md$/, ''), text, verdict };
  });
  if (!pipeline) {
    // As before the pipeline: one comment, updated on every run
    gh(['pr', 'comment', String(n), '-R', REPO, '--edit-last', '--create-if-none', '--body', reviews.map(r => r.text).join('\n\n---\n\n')]);
    return;
  }
  for (const r of reviews) {
    const body = `${r.text}\n\n${marker('agent-review', { sha, model: r.model, verdict: r.verdict, title })}`;
    gh(['api', `repos/${REPO}/pulls/${n}/reviews`, '--input', '-'], {
      token: process.env.REVIEWER_TOKEN,
      input: JSON.stringify({ commit_id: sha, event: reviewEvent(r.verdict), body }),
    });
    console.log(`${r.model}: ${r.verdict} → ${reviewEvent(r.verdict)} on ${sha.slice(0, 7)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'models') {
    const files = pages(`repos/${REPO}/pulls/${args[0]}/files?per_page=100`);
    console.log(`models=${JSON.stringify(reviewModels(files, process.env.CHOSEN ?? 'sonnet', process.env.AGENT_PIPELINE === 'on'))}`);
  } else if (cmd === 'submit-review') submitReview(args[0], args[1]);
  else if (cmd === 'sweep') sweep();
  else if (cmd === 'check-fix') {
    // args: pr, expected head sha, file with the changed paths (one per line)
    const p = api(`repos/${REPO}/pulls/${args[0]}`);
    if (p.state !== 'open' || p.head.sha !== args[1]) { console.log('The pull request moved on; the fix is dropped.'); process.exitCode = 2; }
    else {
      const r = checkFix(readFileSync(args[2], 'utf8').split('\n').filter(Boolean));
      console.log(r.ok ? 'Fix may be pushed' : r.reason);
      process.exitCode = r.ok ? 0 : 1;
    }
  } else {
    console.error('usage: agent-pipeline.mjs models <pr> | submit-review <pr> <dir> | sweep | check-fix <pr> <sha> <paths file>');
    process.exitCode = 2;
  }
}
