# Contributing

Thank you for wanting to help. Walkflow is a small project, so a few rules keep it easy to review and safe to run on a real treadmill.

## Set up

Node.js 24.

```bash
npm ci
npm run dev
```

Without a treadmill, **Demo (no treadmill)** in the connection menu runs against a simulator that speaks real FTMS bytes. Before a
pull request, these have to pass (CI runs them):

```bash
npm run typecheck
npm run lint
npm test
```

## Static analysis

`npm run lint` runs [oxlint](https://oxc.rs/docs/guide/usage/linter) with type information (`--type-aware`, built on
TypeScript 7, which typescript-eslint cannot use) and then [knip](https://knip.dev), which finds unused files, exports and
dependencies. The rules are in `.oxlintrc.json`, knip's entry points (the page, Electron, the scripts, the tests) in `knip.json`.
Above all, no promise may be left unhandled: a forgotten `await` on `tm.stop()` fails the lint. Type information comes from the
three projects that `tsconfig.json` refers to (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for the config and `tests/`,
`tsconfig.electron.json` for `electron/`).

If a rule is wrong for one line, switch it off on that line and say why:

```ts
// oxlint-disable-next-line typescript/no-unnecessary-condition -- the Wake Lock API is missing in Firefox and older Safari
```

Typical cases are browser APIs that the types promise but not every browser has, and checks after an `await` that another call may
have changed in the meantime. In safety code (`src/core/safety/`, anything that ends in a call that drives the belt) a finding that
would change behaviour is not "fixed" in passing: it gets a test first, like any other safety change. Rules that are off for the
whole app, and why:

- `unicorn/prefer-add-event-listener`: the UI assigns `onclick` and the like on purpose, so a re-render replaces the handler
  instead of adding a second one.
- `unicorn/no-useless-spread`: listeners are copied before they are called, so a listener may unsubscribe while the others run.
- `unicorn/no-array-sort`: what is sorted is a fresh copy, and `toSorted` is not in the ES2022 library the app is built against.
- `typescript/consistent-return`: TypeScript already checks that every path of a function returns, also for exhaustive `switch`es.
- `no-await-in-loop`: some steps (retries, ramps) are sequential on purpose.

GitHub's CodeQL (default setup, extended queries) checks the code and the workflows for security problems on every push and pull
request; Dependabot keeps the GitHub Actions, which are pinned by commit, and the dev dependencies current once a month.

## Pull requests

- **The title is a [Conventional Commit](https://www.conventionalcommits.org/).** Pull requests are squash merged, and the title
  becomes the commit message that the release notes and the version are made from. Types: `feat`, `fix`, `perf`, `revert`, and
  **`safety`** for anything that changes the speed limit, the ramp, stopping, or the warnings; `docs`, `refactor`, `test`, `build`,
  `ci`, `style`, `chore` do not appear in the release notes. Example: `fix(routes): keep the progress when a route is updated`.
- **Safety first.** Code that decides what is sent to the treadmill (the app's `src/core/safety/`, and the library [`ftms-treadmill`](https://github.com/walkflow-app/ftms-treadmill), which has its own repository)
  gets its test first, and the change must not weaken a limit, a delay or a warning. If you are not sure, say so in the pull request.
  The CI job `safety-gate` fails a pull request that changes `src/core/safety/`, `src/ui/live/`, `src/core/training/program.ts`,
  `src/ui/background.ts`, `src/main.ts` or `electron/` without changing a test next to that code or under `tests/`, and warns
  when such a change has no `safety` title or no update of HARDWARE-TESTS.md.
- **Small and focused.** One change per pull request, with the tests that show it works.
- **Through a pull request only.** `main` takes no direct pushes; a pull request is merged once CI (`test`) is green.
- **Working with an AI agent?** `CLAUDE.md` holds the rules an agent needs (safety, hardware checks, texts, releases) and
  `.claude/settings.json` the commands it may and may not run, `.claude/skills/` and `.claude/agents/` the ways of working (release,
  hardware checks, specs) and the reviewers (safety, docs and texts, architecture, the site); `.github/CODEOWNERS` names what needs a human review.
- **No new dependency without asking first** (open an issue). What the app runs is bundled at build time and kept small on purpose:
  besides its own code only the treadmill library, the map library and the sharing library.
- **Texts.** The app is in English, German, French and Ukrainian. A new text needs all four (`src/i18n/locales/`); a test checks that
  they have the same shape. If you cannot write one of them, put a clear English text there and say so, and it will be fixed.
- **Structure.** `docs/ARCHITECTURE.md` describes the layers. `npm test` checks them: lower layers do not import higher ones, nothing
  from sharing can reach the treadmill commands, and the pure layers have no DOM.

## Agents on GitHub

Every new pull request gets a review by AI agents (`.github/workflows/agent-review.yml`): they check what this repository's
`CLAUDE.md` asks for and post their verdict. Maintainers can ask for more with `@claude …` in a comment, or hand over an issue
with the label `agent-ready` (`.github/workflows/claude.yml`); agents never take on issues labelled `safety`. Pull requests
from forks are not reviewed by agents. A review runs with another model than the one that wrote the change (Opus and Sonnet
check each other; `.github/scripts/review-model.sh`).

**The agent pipeline** (repository variable `AGENT_PIPELINE` = `on`; off, the verdict is a comment and a maintainer merges)
takes a pull request to `main` without a maintainer. The rules are in `scripts/agent-pipeline.mjs` and its tests:

- The review is a review of the app *walkflow-reviewer* on the reviewed commit: `OK` approves, `OK with remarks` comments,
  `changes needed` and `blocking` request changes. It runs again on every new commit.
- `agent-pipeline.yml` (after a review, CI or a fix, and every 15 minutes) decides: merge (squash) when the head commit is
  approved, `test` and `safety-gate` are green and there is no conflict; start `agent-fix.yml` for remarks, a failing check or
  a conflict (one try per commit); or hand over to the maintainer with the label `needs-maintainer` and a comment why. Removing
  the label hands it back. At most 4 reviewed commits per pull request; past 5 agent merges a day the rest waits for the next
  day. A small fix of remarks (30 lines, no safety path, no deleted test) is merged without waiting for another review; every
  other fix is reviewed again. A pull request with changes requested by a person is left alone.
- The fix agent works without a write token and hands over a patch; the app *walkflow-writer* pushes it after checking what it
  changes. A pull request `claude.yml` opened (with the workflow token, which starts no workflow) gets one empty commit by the
  app, which starts CI and the review; the agent in `claude.yml` never gets the app's token.
- **Safety changes** (`src/core/safety/`, `src/ui/live/`, `src/core/training/`, Bluetooth devices, `src/main.ts`, a new
  `ftms-treadmill` version) are reviewed by Opus and Sonnet, merged only when both say `OK` and on top of the current `main`,
  and get the label `needs-hardware`.
- **Never merged by an agent:** changes to `.github/`, `.claude/`, `CLAUDE.md`, `scripts/`, `HARDWARE-TESTS.md`, dependencies
  and npm settings, the test, lint, build and release configuration, `index.html`, `electron/`, `public/legal/`, `src/net/`,
  `src/core/share/` (`PROTECTED` in `scripts/agent-pipeline.mjs`); drafts; pull requests from forks or from outside the
  organisation; release-please and Dependabot; anything labelled `hold`.
- **The release gate:** a release is built only when every pull request since the last release that touches a safety path or
  has `needs-hardware` has a comment that is only `/hardware-ok`, by an owner in `.github/CODEOWNERS` and written after its
  merge (or one on the release pull request after the last of them was merged), once its checks in HARDWARE-TESTS.md passed
  on a treadmill (`scripts/release-gate.mjs`, in `release.yml` and the `release` skill).

A new issue from someone outside the project is sorted by `triage.yml`: an agent that can only read proposes labels,
duplicates, missing details and where in the code it is; a second job without an agent checks that and writes the labels and
one comment. It never sets `agent-ready`, closes or moves an issue. Actions → Triage → Run workflow sorts any issue again.

On a schedule: `relays.yml` checks the pinned relays every Monday and opens an issue "Relay check failed" when one fails twice
(no agent); `docs-check.yml` has an agent read the docs against the code once a month and list what is no longer true in an
issue "Docs out of date". Neither changes code; a fix is a pull request like any other.

## Adding a route to the route store

Routes are files in their own repository, [walkflow-app/route-store](https://github.com/walkflow-app/route-store), and a pull request there is
how one gets in. How to make the file, what it has to say (author, licence, source) and how the check works is in its README; the
format is in [`docs/ROUTE-PACKAGE.md`](docs/ROUTE-PACKAGE.md).

Only add a route that you made yourself or that is under a licence that allows it, say which in the file, and do not add one that
gives away where you live. A maintainer looks at every route before it is merged.

## Reporting a bug

Use the bug report form. For anything that has to do with the belt not stopping, see [SECURITY.md](SECURITY.md) instead.
