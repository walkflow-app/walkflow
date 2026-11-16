import { describe, expect, it } from 'vitest';
// @ts-expect-error plain script without types, also run by node in CI
import { checkFix, classify, decide, LIMITS, marker, parseVerdict, quiet, reviewEvent, reviewModels, REVIEWER, WRITER } from '../scripts/agent-pipeline.mjs';
// @ts-expect-error plain script without types, also run by node in CI
import { confirms, releaseGate } from '../scripts/release-gate.mjs';

const HEAD = 'h'.repeat(40);
const OLD = 'o'.repeat(40);
const TITLE = 'fix(routes): keep the name';
type Verdict = 'OK' | 'OK with remarks' | 'changes needed' | 'blocking';
const review = (verdict: Verdict, model = 'opus', sha = HEAD, title = TITLE) => ({
  user: REVIEWER, userType: 'Bot', state: 'COMMENTED', commitId: sha, submittedAt: '2026-11-16T10:00:00Z',
  body: `Summary\n\nAgent review: ${verdict}\n\n${marker('agent-review', { sha, model, verdict, title })}`,
});
const fixDone = (sha: string, mode: string) => ({ user: WRITER, body: `Fixed\n${marker('agent-fix', { sha, mode })}` });

interface File { filename: string; previous_filename?: string; status?: string; additions?: number; deletions?: number }
interface Since { base: string; status: string; files: File[] }
interface State {
  pipeline: boolean;
  pr: {
    number: number; draft: boolean; headRef: string; headSha: string; headRepo: string; repo: string;
    author: { login: string; type: string }; authorAssociation: string; title: string; labels: string[];
  };
  files: File[];
  issueAuthors: string[];
  reviews: (ReturnType<typeof review> | { user: string; body: string; commitId: string })[];
  comments: { user: string; body: string }[];
  checks: Record<string, string>;
  mergeable: string;
  behindBy: number;
  sinceReviewed: Since | null;
  running: { review: boolean; fix: boolean };
  humanChangesRequested: boolean;
  holdResetAt: string | null;
  mergedToday: number;
  headAgeHours: number;
}

/** A pull request that is reviewed OK, green and mergeable; each test changes one thing */
function state(change: (s: State) => void = () => {}) {
  const s: State = {
    pipeline: true,
    pr: {
      number: 7, draft: false, headRef: 'fix/name', headSha: HEAD, headRepo: 'walkflow-app/walkflow', repo: 'walkflow-app/walkflow',
      author: { login: 'someone', type: 'User' }, authorAssociation: 'OWNER', title: TITLE, labels: [],
    },
    files: [{ filename: 'src/ui/routes/list.ts', status: 'modified', additions: 3, deletions: 1 }],
    issueAuthors: [],
    reviews: [review('OK')],
    comments: [],
    checks: { test: 'success', 'safety-gate': 'success' },
    mergeable: 'MERGEABLE',
    behindBy: 0,
    sinceReviewed: null,
    running: { review: false, fix: false },
    humanChangesRequested: false,
    holdResetAt: null,
    mergedToday: 0,
    headAgeHours: 1,
  };
  change(s);
  return decide(s);
}
const safetyFiles = [{ filename: 'src/core/safety/limit.ts', status: 'modified', additions: 2, deletions: 2 }];

describe('agent pipeline: the verdict', () => {
  it('reads the last verdict of a summary', () => {
    expect(parseVerdict('x\nAgent review: OK')).toBe('OK');
    expect(parseVerdict('Agent review: **OK with remarks**')).toBe('OK with remarks');
    expect(parseVerdict('safety: OK\nAgent review: changes needed')).toBe('changes needed');
    expect(parseVerdict('Agent review: blocking. Then Agent review: OK')).toBe('OK');
    expect(parseVerdict('no verdict')).toBeNull();
  });

  it('turns it into a review state', () => {
    expect(reviewEvent('OK')).toBe('APPROVE');
    expect(reviewEvent('OK with remarks')).toBe('COMMENT');
    expect(reviewEvent('changes needed')).toBe('REQUEST_CHANGES');
    expect(reviewEvent('blocking')).toBe('REQUEST_CHANGES');
  });

  it('never calls claude.yml from its own texts', () => {
    expect(quiet('comment @claude review or @Claude fix')).not.toMatch(/@claude/i);
  });
});

describe('agent pipeline: the files', () => {
  it('finds safety paths and protected paths, also under the old name of a rename', () => {
    expect(classify(safetyFiles).safety).toBe(true);
    expect(classify([{ filename: 'src/ui/x.ts', previous_filename: '.github/workflows/ci.yml', status: 'renamed' }]).protected).toEqual(['.github/workflows/ci.yml']);
    for (const f of ['CLAUDE.md', 'package.json', 'scripts/safety-gate.mjs', 'electron/main.ts', 'src/net/relay.ts', 'HARDWARE-TESTS.md', 'tests/architecture.test.ts'])
      expect(classify([{ filename: f }]).protected).toEqual([f]);
    expect(classify([{ filename: 'src/ui/routes/list.ts' }]).protected).toEqual([]);
  });

  it('fails closed when the API cannot list all files', () => {
    expect(classify(Array.from({ length: 3000 }, (_, i) => ({ filename: `src/ui/f${i}.ts` }))).protected).toHaveLength(1);
  });

  it('two models review a safety change, one otherwise, one when the pipeline is off', () => {
    expect(reviewModels(safetyFiles, 'sonnet', true)).toEqual(['opus', 'sonnet']);
    expect(reviewModels([{ filename: 'README.md' }], 'sonnet', true)).toEqual(['sonnet']);
    expect(reviewModels(safetyFiles, 'opus', false)).toEqual(['opus']);
  });

  it('never pushes a fix that reaches a protected file', () => {
    expect(checkFix(['src/ui/a.ts']).ok).toBe(true);
    expect(checkFix(['src/ui/a.ts', '.github/workflows/agent-fix.yml']).ok).toBe(false);
  });
});

describe('agent pipeline: what happens next', () => {
  it('merges a reviewed, green, mergeable pull request', () => {
    expect(state()).toMatchObject({ action: 'merge', sha: HEAD });
  });

  it('does nothing when switched off, for drafts, forks, release and Dependabot, outsiders and other bots', () => {
    expect(state(s => { s.pipeline = false; }).action).toBe('skip');
    expect(state(s => { s.pr.draft = true; }).action).toBe('skip');
    expect(state(s => { s.pr.headRepo = 'someone/walkflow'; }).action).toBe('skip');
    expect(state(s => { s.pr.headRef = 'release-please--branches--main'; }).action).toBe('skip');
    expect(state(s => { s.pr.headRef = 'dependabot/npm_and_yarn/x'; }).action).toBe('skip');
    expect(state(s => { s.pr.authorAssociation = 'CONTRIBUTOR'; }).action).toBe('skip');
    expect(state(s => { s.pr.author = { login: 'other[bot]', type: 'Bot' }; }).action).toBe('skip');
    expect(state(s => { s.pr.labels = ['hold']; }).action).toBe('skip');
    expect(state(s => { s.pr.labels = ['needs-maintainer']; }).action).toBe('skip');
  });

  it('takes pull requests of the writer app, unless their issue came from outside', () => {
    expect(state(s => { s.pr.author = { login: WRITER, type: 'Bot' }; s.pr.authorAssociation = 'NONE'; }).action).toBe('merge');
    expect(state(s => { s.pr.author = { login: WRITER, type: 'Bot' }; s.issueAuthors = ['NONE']; }).action).toBe('hold');
  });

  it('hands protected files to the maintainer, whatever the review says', () => {
    const d = state(s => { s.files.push({ filename: '.github/workflows/agent-pipeline.yml', status: 'modified' }); });
    expect(d.action).toBe('hold');
    expect(d.reason).toContain('.github/workflows/agent-pipeline.yml');
  });

  it('waits while a review or a fix runs, or a person requested changes', () => {
    expect(state(s => { s.running.review = true; }).action).toBe('wait');
    expect(state(s => { s.running.fix = true; }).action).toBe('wait');
    expect(state(s => { s.humanChangesRequested = true; }).action).toBe('wait');
  });

  it('counts only reviews of the reviewer app on the head commit', () => {
    expect(state(s => { s.reviews = [{ ...review('OK'), user: 'someone-else' }]; }).action).toBe('wait');
    expect(state(s => { s.reviews = [review('OK', 'opus', OLD)]; }).action).toBe('wait');
    expect(state(s => { s.reviews = [{ ...review('OK'), body: 'Agent review: OK' }]; }).action).toBe('wait');
  });

  it('remarks: fix first, then merge; changes needed: fix, and hold if the fix changed nothing', () => {
    expect(state(s => { s.reviews = [review('OK with remarks')]; })).toMatchObject({ action: 'fix', mode: 'remarks', sha: HEAD });
    expect(state(s => { s.reviews = [review('OK with remarks')]; s.comments = [fixDone(HEAD, 'remarks')]; }).action).toBe('merge');
    expect(state(s => { s.reviews = [review('changes needed')]; })).toMatchObject({ action: 'fix', mode: 'remarks' });
    expect(state(s => { s.reviews = [review('changes needed')]; s.comments = [fixDone(HEAD, 'remarks')]; }).action).toBe('hold');
    expect(state(s => { s.reviews = [review('blocking')]; }).action).toBe('hold');
  });

  it('a fix marker counts only from the writer app', () => {
    expect(state(s => { s.reviews = [review('OK with remarks')]; s.comments = [{ ...fixDone(HEAD, 'remarks'), user: 'someone' }]; }).action).toBe('fix');
  });

  describe('a small fix of remarks merged without another review', () => {
    const fixed = (change: (s: State & { sinceReviewed: Since }) => void = () => {}) => state(s => {
      const since: Since = { base: OLD, status: 'ahead', files: [{ filename: 'src/ui/routes/list.ts', status: 'modified', additions: 10, deletions: 5 }] };
      s.reviews = [review('OK with remarks', 'opus', OLD)];
      s.comments = [fixDone(OLD, 'remarks')];
      change(Object.assign(s, { sinceReviewed: since }));
    });
    it('is merged', () => expect(fixed().action).toBe('merge'));
    it('waits for a review when it is too big, not on top of the reviewed commit, touches a safety path or deletes a test', () => {
      expect(fixed(s => { s.sinceReviewed.files = [{ filename: 'src/ui/routes/list.ts', status: 'modified', additions: LIMITS.unreviewedLines, deletions: 5 }]; }).action).toBe('wait');
      expect(fixed(s => { s.sinceReviewed.status = 'diverged'; }).action).toBe('wait');
      expect(fixed(s => { s.sinceReviewed.files.push({ filename: 'src/ui/live/view.ts', status: 'modified', additions: 1 }); }).action).toBe('wait');
      expect(fixed(s => { s.sinceReviewed.files.push({ filename: 'src/ui/a.test.ts', status: 'removed', deletions: 1 }); }).action).toBe('wait');
      expect(fixed(s => { s.comments = []; }).action).toBe('wait');
      expect(fixed(s => { s.reviews = [review('changes needed', 'opus', OLD)]; }).action).toBe('wait');
    });
    it('never for a safety change', () => {
      expect(fixed(s => { s.files = safetyFiles; s.sinceReviewed.files = [{ filename: 'src/ui/x.ts', additions: 1 }]; }).action).toBe('wait');
    });
  });

  it('a safety change needs OK from both models, and is merged only on top of main', () => {
    const safe = (change: NonNullable<Parameters<typeof state>[0]>) => state(s => { s.files = safetyFiles; s.pr.labels = ['needs-hardware']; change(s); });
    expect(safe(() => {}).action).toBe('wait');
    expect(safe(s => { s.reviews = [review('OK', 'opus'), review('OK', 'sonnet')]; }).action).toBe('merge');
    expect(safe(s => { s.reviews = [review('OK', 'opus'), review('OK with remarks', 'sonnet')]; }).action).toBe('fix');
    expect(safe(s => { s.reviews = [review('OK', 'opus'), review('OK', 'sonnet')]; s.behindBy = 2; }).action).toBe('update');
  });

  it('labels a safety change needs-hardware', () => {
    expect(state(s => { s.files = safetyFiles; }).addLabels).toEqual(['needs-hardware']);
    expect(state().addLabels).toEqual([]);
  });

  it('stops after the limit of reviews', () => {
    const many = Array.from({ length: LIMITS.reviews }, (_, i) => review('changes needed', 'opus', i === LIMITS.reviews - 1 ? HEAD : `${i}`.repeat(40)));
    expect(state(s => { s.reviews = many; }).action).toBe('hold');
    expect(state(s => { s.reviews = many; s.holdResetAt = '2026-11-17T00:00:00Z'; }).action).toBe('fix');
  });

  it('checks: waits for them, fixes a failing one once, never merges without them', () => {
    expect(state(s => { s.checks = { test: 'success' }; }).action).toBe('wait');
    expect(state(s => { s.checks = { test: 'success', 'safety-gate': 'skipped' }; }).action).toBe('wait');
    expect(state(s => { s.checks.test = 'failure'; })).toMatchObject({ action: 'fix', mode: 'checks' });
    expect(state(s => { s.checks.test = 'failure'; s.comments = [fixDone(HEAD, 'checks')]; }).action).toBe('hold');
    expect(state(s => { s.checks = {}; s.headAgeHours = LIMITS.staleHours + 1; }).action).toBe('hold');
  });

  it('a conflict: one try by the fix agent, then the maintainer', () => {
    expect(state(s => { s.mergeable = 'CONFLICTING'; })).toMatchObject({ action: 'fix', mode: 'conflict' });
    expect(state(s => { s.mergeable = 'CONFLICTING'; s.comments = [fixDone(HEAD, 'conflict')]; }).action).toBe('hold');
    expect(state(s => { s.mergeable = 'UNKNOWN'; }).action).toBe('wait');
  });

  it('the title: a Conventional Commit without "!", the one that was reviewed', () => {
    expect(state(s => { s.pr.title = 'Fix the name'; }).action).toBe('hold');
    expect(state(s => { s.pr.title = 'feat!: everything new'; }).action).toBe('hold');
    expect(state(s => { s.pr.title = 'chore: nothing to see'; }).action).toBe('hold');
  });

  it('at most a few agent merges a day', () => {
    expect(state(s => { s.mergedToday = LIMITS.mergesPerDay; }).action).toBe('wait');
  });
});

describe('release gate', () => {
  const maintainer = { userType: 'User', association: 'OWNER', body: '/hardware-ok all checks passed' };
  const pr = (files: string[], comments: (typeof maintainer)[] = [], labels: string[] = []) => ({ number: 1, title: 't', files: files.map(filename => ({ filename })), labels, comments });

  it('holds a release with a safety change nobody checked on a treadmill', () => {
    expect(releaseGate([pr(['src/core/safety/a.ts'])])).toHaveLength(1);
    expect(releaseGate([pr(['src/ui/routes/a.ts'], [], ['needs-hardware'])])).toHaveLength(1);
    expect(releaseGate([pr(['src/ui/routes/a.ts'])])).toHaveLength(0);
  });

  it('lets it pass after the maintainer confirmed, on the pull request or once on the release pull request', () => {
    expect(releaseGate([pr(['src/core/safety/a.ts'], [maintainer])])).toHaveLength(0);
    expect(releaseGate([pr(['src/core/safety/a.ts'])], [maintainer])).toHaveLength(0);
  });

  it('only a person of the organisation confirms', () => {
    expect(confirms({ ...maintainer, userType: 'Bot' })).toBe(false);
    expect(confirms({ ...maintainer, association: 'NONE' })).toBe(false);
    expect(confirms({ ...maintainer, body: 'looks fine, /hardware-ok later' })).toBe(false);
  });
});
