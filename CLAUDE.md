# Walkflow: notes for agents

Walkflow drives a real treadmill that a person is standing on. Safety is a matter of course here, not the goal that overrides
everything: code that can end in a command to the belt (**belt code**, the list `SAFETY` in `scripts/paths.mjs`) is built test
first and reviewed twice; everything else, also what lies nearby, is ordinary work. Agents build and merge belt code (the
maintainer's decision, 2026-11-22); the check on a treadmill comes once, bundled, before the release. Read [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing code; this file only adds what an agent tends to miss.

## The repositories of walkflow-app

Cloned side by side in one folder, so relative paths like `../ftms-treadmill` work:

| Repository | What | Notes |
| --- | --- | --- |
| `walkflow` (this one) | The app (PWA and Electron) and the product page (`site/`) | |
| `ftms-treadmill` | The library that drives the belt (FTMS, BLE, safety, start and stop) | The app pins an exact npm version. A library change reaches the app only through a library release and a version bump here; to try it before that, `npm run build` there and `npm link ../ftms-treadmill` here. |
| `route-store` | Routes for the in-app store, and the tooling to make them | |
| `meta` | Internal planning, private to the organisation's members: specs across repositories, decisions, the setup | Read the decisions before proposing bigger work. Never copy internal notes from there into this public repository without the maintainer agreeing. |
| `walkflow-app.github.io` | The deployed site | **Build output only.** `.github/workflows/pages.yml` replaces it on every deploy. Never edit it; change `site/` (or the app) here. |

## Roadmap

[ROADMAP.md](ROADMAP.md) is the public plan of this repository (*Now*, *Next*, *Later, maybe*, *Done recently*). Only the
maintainer moves something into *Now*. When a pull request finishes a roadmap item, move it to *Done recently* in the same
pull request; when it drops one, remove it.

## Rules

- **English in the repository**: docs, code comments, test names, commit messages, workflow step names. Exceptions: the
  locale files, the de/fr/uk legal pages, `legacy/`.
- **Safety test first.** Anything that changes the speed limit, the ramp, stopping or the warnings (`src/core/safety/`, and
  everything that ends in a call that drives the belt) gets its failing test before the code, and must not weaken a limit,
  a delay or a warning. Most of that logic lives in `ftms-treadmill`; change it there.
- **You cannot test Bluetooth.** For a change that touches the treadmill, say exactly what to check in the log (hex bytes,
  expected lines) and add or update the checks in [HARDWARE-TESTS.md](HARDWARE-TESTS.md). Not yet confirmed on a treadmill,
  so never treat as known: incline, heart rate, program transitions, reconnecting, the belt on a lost connection.
- **Every UI text in all four locales** (`src/i18n/locales/`: en, de, fr, uk). Say in the pull request that fr and uk are
  not proofread by a native speaker.
- **Docs in the same pull request.** With every change, check README.md, HARDWARE-TESTS.md, CONTRIBUTING.md and `docs/*.md`
  for text it makes wrong, and fix it there.
- **Never invent** legal texts, addresses, names or donation links. The maintainer fills those in.
- **Layers** are enforced by `tests/architecture.test.ts`. `src/net/` and `src/core/share/` (sharing with other devices) must
  never reach the treadmill. Every peer is hostile: validate, limit, and let the person confirm before anything is saved.

## Commands

```bash
npm ci
npm run typecheck && npm run lint && npm test   # what CI runs; all three must pass before a pull request
npm run dev                                     # Demo (no treadmill) in the connection menu runs a simulator speaking real FTMS bytes
```

## Commits and pull requests

- One branch and one pull request per change, from `main`. Avoid stacked pull requests: squash merging and deleting the base
  branch closes the one on top.
- The pull request title becomes the squash commit and must be a Conventional Commit; release-please makes the version and
  the changelog from it (table in README → *Versions and releases*). `safety` for limit, ramp, stop or warnings. Changes only
  to `site/` or the Pages workflow are `docs(site)` or `chore(site)`, never `feat(site)` (that would open a release).
- `main` takes changes only through pull requests with CI (`test` and `safety-gate`) green.

## How work is done here

- **Bigger features start as a spec** (skill `write-spec`, in `docs/specs/`); code starts once the maintainer set it to
  `accepted`. Small fixes need none.
- **Before opening a pull request**, run the reviewers that apply and fix what they find (or say in the pull request why not):
  - `safety-reviewer` when the diff touches belt code (`SAFETY` in `scripts/paths.mjs`), trust-boundary code (`TRUST`:
    `src/net/`, `src/core/share/`), Bluetooth, the `ftms-treadmill` version, or anything that ends in a call that drives the belt;
  - `docs-i18n-reviewer` for every change to behaviour, settings, UI texts or the site;
  - `architect` for a spec, a refactor, or a change across layers or repositories.
  Reviewers run with another model than the one that wrote the change: written with Opus, the reviewer runs with Sonnet, and
  the other way round; when that is unclear, Opus for safety code, Bluetooth, sharing, the library version or big changes,
  else Sonnet. On GitHub `.github/scripts/review-model.sh` picks it the same way, from the Co-Authored-By lines of the
  commits.
- **Treadmill checks**: skill `hardware-check` writes them into HARDWARE-TESTS.md, reads a log the maintainer pastes, and
  prepares a guided session at the treadmill (mode C: the build running, the log followed, the steps).
- **Website**: agent `site-editor`.
- **"release"**: skill `release` (the whole chain, publishing included; it stops before publishing safety changes).
- **Agent pipeline** (`AGENT_PIPELINE` = `on`, CONTRIBUTING.md → *Agents on GitHub*): agents review, fix and merge pull
  requests themselves; changes that reach the belt wait for the maintainer's `/hardware-ok` before a release, and the paths
  in `PROTECTED` of `scripts/agent-pipeline.mjs` are never merged by an agent. Never change that list, the gates or the
  workflows to let more through without being asked.
- **On GitHub:** `agent-review.yml` runs the reviewers on every new pull request and posts their verdicts (comment
  `@claude review` to run it again); `claude.yml` takes on `@claude …` requests and issues labelled `agent-ready` (belt code
  too: test first, with the safety reviewer; not `needs-maintainer`, `stuck` or `hold`); `dispatch.yml` starts the tasks of approved features whose blockers are closed
  (`scripts/feature-gate.mjs`). The agents only work on branches and pull requests; with the pipeline off a maintainer merges. Scheduled: `docs-check.yml` (monthly,
  an issue "Docs out of date"), `relays.yml` (weekly, an issue when a relay fails twice). New issues from outside:
  `triage.yml` (labels and one comment, never `agent-ready`).

## Never without being asked

Publish to npm, force-push, merge with `--admin`, push to the site repository, change repository settings, rulesets or
secrets, or delete releases, tags or branches other than your own.
