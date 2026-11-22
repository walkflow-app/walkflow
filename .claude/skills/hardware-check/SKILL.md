---
name: hardware-check
description: Write the treadmill checks for a change into HARDWARE-TESTS.md (exact log lines and hex bytes to expect), or read a log the maintainer pasted from a real treadmill and compare it with those checks, or prepare a guided session at the treadmill (the build in a Chrome of its own, the log followed, a list of steps). Use for any change that touches Bluetooth, the belt, the ramp, start, stop, incline or the live view, whenever a treadmill log is pasted, and whenever the maintainer has to check something on the treadmill.
---

# Hardware checks

Agents cannot run a treadmill. The maintainer runs the checks on a Sportstech sPad 500 (a walking pad without a safety key,
FW 1.023). Everything they need has to be in [HARDWARE-TESTS.md](../../../HARDWARE-TESTS.md), written so they can compare
line by line. Never mark something as confirmed that no log showed.

## Mode A: write the checks for a change

1. Find what the change can do on the belt: which commands, in which order, which log lines, which warnings or banners.
   Read the code that writes the log (`log(...)` in the app, the notices of `ftms-treadmill`) instead of guessing the text.
2. Add a section (or items to the matching section) in HARDWARE-TESTS.md. Each item:
   - `- [ ] **Short name.** What to do (belt speed, which button), then "Expected:" with the exact log lines in English and the
     hex bytes, and what would be suspicious.`
   - Start with what is safe: belt standing, low speed, standing on the side rails.
3. If the change makes an older item wrong, change that item too (and say so in the pull request).
4. In the pull request, list the new items under "Needs a treadmill".

## Mode B: read a log

The maintainer pastes a log (times `HH:MM:SS`, `→` sent, `←` answers, `ℹ` status). Then:

1. For each open item that the log covers: does it match the expected lines and bytes? Quote the lines that decide it.
2. Tick what passed, with device, date and what the log showed in italics, like the existing results
   (`*sPad 500, 2026-11-10: …*`). Leave unclear items open and say what is missing.
3. Anything unexpected (other status bytes, missing answers, `failed`, a jump in speed, a write after a stop) goes into the
   results section at the top with the hex bytes, and is reported to the maintainer first. If it can hurt someone, say so
   plainly and propose to hold the release.

## Mode C: a guided session at the treadmill

Whenever the maintainer has to do something at the treadmill (open items here, an issue labelled `needs-hardware`, a pull
request waiting for `/hardware-ok`), prepare it so they can start at once, and read the log yourself.

1. **Plan the session.** Collect what needs the same build: the release (the live app, `https://walkflow-app.github.io/app/`)
   or one branch or pull request. Say which, and what each item checks.
2. **Start it**, with `scripts/hardware-session.mjs` (from this repository's `main`):
   - a branch or pull request: `node scripts/hardware-session.mjs serve <ref | PR number>`, in the background; it builds in a
     worktree of its own and serves on `http://localhost:4173/`. `npm ci` and the build run that code on the maintainer's
     computer: read the diff first for changed dependencies, scripts or build config (the script refuses forks);
   - `node scripts/hardware-session.mjs chrome <url>`: a Chrome with a profile of its own and the DevTools port, the app in
     English (`?lang=en`) so the log reads as quoted here (macOS; elsewhere set `$CHROME` to the browser);
   - `node scripts/hardware-session.mjs watch`, in the background: every line of the Log card, console warnings and errors
     and uncaught exceptions go into a file (it prints where). Start it before handing over, and check the file says
     `attached` (`no tab with the app yet` means Chrome is not open on the app); for a local build it then drops the old
     service worker and loads the page again.
3. **Hand over a numbered list**: one action per step, what they should see, where to stop and tell you. Safe first (belt
   standing, then standing on the side rails, low speed), the treadmill's own stop in reach in every step; never a step
   where only the app could stop the belt. If the test needs nothing from the person but "done", say so.
4. **Read the log** when they report (or at a step where you asked them to): Mode B, from the file. Ask only for what no log
   shows (the treadmill's display, what the belt did, a text on the screen).
5. **Record**: tick the items here (Mode B, in a pull request), comment the results on the issue or pull request. The
   advertised device name (`Device: …`) stays out of public comments unless the item needs it. Stop the watcher and the
   server; the Chrome profile and the worktree stay for the next session (to remove the worktree:
   `git worktree remove <dir>/build`).

The desktop app is not covered yet.

## FTMS bytes (Control Point and Machine Status)

| Bytes | Meaning |
| --- | --- |
| `00` | Request Control (answer `← Request Control: OK`) |
| `02 <lo> <hi>` | Set Speed, little endian, 0.01 km/h: `02 64 00` = 1.0, `02 fa 00` = 2.5, `02 f4 01` = 5.0, `02 bc 02` = 7.0 |
| `03 <lo> <hi>` | Set Inclination, little endian, signed, 0.1 %: `03 0a 00` = 1.0 %, `03 32 00` = 5.0 % (the sPad 500 shows these as levels) |
| `07` | Start or resume |
| `08 01` / `08 02` | Stop / Pause (go out ahead of everything queued, up to 3 tries) |
| `ℹ Status 02 01` / `02 02` | Machine Status: stopped / paused by the treadmill |
| `ℹ Status 03` | Safety key pulled (never seen on the sPad 500, which has none) |
| `ℹ Status 05 <lo> <hi>` | Target speed changed on the device (never seen on the sPad 500) |
| `ℹ Status ff` | Control lost |

Known on the sPad 500: a stop from its button reports `02 01` after 4 to 8 s; the countdown after Start is about 3 s; it
remembers the last Set Speed (hence `→ 02 64 00` before `→ 07`); incline is ignored while the belt stands.

Still unconfirmed on any treadmill (never write them as known): heart rate, program transitions, reconnecting, what the belt
does when the connection is lost.
