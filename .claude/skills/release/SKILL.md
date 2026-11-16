---
name: release
description: Release the Walkflow app end to end - merge the release-please pull request, watch the build, publish the draft, deploy the site and check it live. Use when the maintainer says "release" (or "release the app", "ship it") in the walkflow repository.
---

# Release the Walkflow app

The maintainer saying "release" is the go-ahead for the whole chain, publishing included. Do every step yourself and watch
each one to the end; do not ask per step. Stop and ask only where this file says so.

## 1. The release pull request

```bash
gh pr list --search "chore: release in:title" --state open
gh pr view <n>   # the changelog it adds to CHANGELOG.md
```

Check that the changelog lists what was merged since the last release (`git log v<last>..origin/main --oneline`). No CI checks
on this pull request is normal (it is made with the workflow token).

Then the release gate, which also catches safety code merged under another title or by an agent:

```bash
git fetch --tags && node scripts/release-gate.mjs origin/main <n>
```

**Stop and ask before step 2** if it fails, or if the changelog has a *Safety* section, a change to Bluetooth, the ramp, start
or stop, or a new `ftms-treadmill` version: list the HARDWARE-TESTS.md checks that have to pass on the treadmill first (use
the `hardware-check` skill to name them) and the pull requests the gate names, and wait. The maintainer confirms with a
comment `/hardware-ok` on each of them, or once on the release pull request for all; run the gate again before merging.
`release.yml` runs the same gate and builds nothing without it.

Also list the pull requests an agent merged since the last release, so the maintainer sees what went in without them:
`gh pr list --state merged --search "merged:>=<date of the last release>" --json number,title,mergedBy --jq '.[] | select(.mergedBy.login == "walkflow-writer") | "#\(.number) \(.title)"'`.

## 2. Merge and watch the build

```bash
gh pr merge <n> --squash --delete-branch
gh run list -w release-please.yml -L 1          # then
gh run watch <id> --exit-status
```

The run is release-please → desktop (plan, build on windows and ubuntu) → release. On a failure: `gh run view <id> --log-failed`,
report it, stop.

## 3. Check the draft

```bash
gh release view v<version> --json isDraft,assets --jq '.isDraft, [.assets[].name]'
```

It must be a draft with: the Windows `.exe` and its `.blockmap`, the `.AppImage`, `latest.yml`, `latest-linux.yml`,
`SHA256SUMS.txt`. (macOS only if the repository variable `MAC_BUILD` is set; see README → *Versions and releases*.)

## 4. Publish

```bash
gh release edit v<version> --draft=false --latest
```

## 5. The site

Publishing starts the *Pages* workflow (`release: published`). Watch it:

```bash
gh run list -w pages.yml -L 1
gh run watch <id> --exit-status
```

If no run started within a minute, start one: `gh workflow run pages.yml --ref main`. It fails on purpose while
`public/legal` contains `TODO`.

## 6. Check it live

```bash
curl -s https://walkflow-app.github.io/ | grep -o 'Walkflow-[0-9.]*-[^"]*' | sort -u
```

The download links must name the new version (GitHub Pages can take a minute). Then report in a few lines: version, what is
in it, the release and site links, anything that needed a second try.
