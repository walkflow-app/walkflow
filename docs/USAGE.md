# Anonymous usage counts

Walkflow counts anonymously how often it is used, to improve it. This page lists every name the app can send and what is
never sent. The names are built by the code from fixed parts (`src/core/usage/events.ts`, `src/core/usage/treadmill.ts`); the only part
that is not fixed is the treadmill's maker and model as it reports them, and only after a guard (see *Names*). Nothing
typed, measured or identifying is ever part of one. A test (`tests/usage-docs.test.ts`) keeps the lists below equal to the code.

## How it is sent

- Each event is one request to the counting service, with the name as the "page":
  `GET https://<code>.goatcounter.com/count?p=<name>&t=<name>&e=true`. No token, no cookie, nothing written to the device.
- **The address is a build setting** (`WALKFLOW_USAGE`, see the README). A build without it, such as a fork or a build from
  source, sends nothing. An official build sends nothing until the maintainer sets it.
- Each name is sent at most once per start of the app (kept in memory only).
- Nothing is sent before the first-start popup (the safety notice) is accepted; what comes before is dropped, not queued.
- A request that fails, is blocked or never answers changes nothing.
- Your IP address reaches the counting service, as with every website. It is not stored or linked by the app, and the app
  links no two events of a person.
  What the service does with it is GoatCounter's own statement, not the app's: its [privacy page](https://www.goatcounter.com/privacy)
  says that it does not store IP addresses, and that is what the small print on the product page repeats as GoatCounter's
  statement.

## Levels

| Level | What | Switch |
| --- | --- | --- |
| 1 Used | The app was started: platform and version | none |
| 2 Improve | Which functions are used | "Help to improve by sharing anonymously which features I use" (internal name Improve), on unless switched off |
| 3 Errors | Which known error happened, in which version (comes with the error codes) | "Share errors anonymously" (internal name Errors), on unless switched off |

The two switches are the only thing stored for the counts: `walkflow.usageImprove` and `walkflow.usageErrors`, where
absent means on and `0` means off. The switches are in the settings, Info tab, section "Usage data", which also says what is
sent and where it goes (without a counter in the build it says that nothing is sent and shows no switches). The first-start
popup and the Info tab carry a short notice that points there, only in a build that has a counter.

The small print on the product page says that the switches exist. It is built in only with `WALKFLOW_USAGE`, so the official
build is switched on (walkflow#85) only after the switches are in the settings (walkflow#76); nothing before that says it.

## Names

Level 1:

- `app.<web|win|mac|linux>.v<x.y.z>`

Level 2:

- `lang.en`
- `lang.de`
- `lang.fr`
- `lang.uk`
- `run.free`
- `run.workout`
- `run.route`
- `view.training`
- `view.workouts`
- `view.routes`
- `view.history`
- `workout.interval`
- `workout.weekplan`
- `workout.import`
- `route.own`
- `route.gpx`
- `route.map-on`
- `history.csv`
- `history.tcx`
- `store.open`
- `store.add`
- `store.route.<name>`
- `tm.<maker>.<model>`
- `tm.<maker>.unknown`
- `tm.unknown.<model>`
- `tm.unknown`
- `tm.demo`

When they are sent: a view name when the view is opened (the Community view counts nothing; `view.training` comes at nearly every
start, because Training is the view the app opens on). `workout.interval` when a new
workout is saved in the editor, `workout.weekplan` when the week plan is saved, `workout.import` when a workout package is
imported. `route.own` when the walking speed or description of a route is saved, `route.gpx` when a GPX file is imported,
`route.map-on` when the map is switched on. `history.csv` and `history.tcx` when the recording is exported. `store.open` when
the route store is opened. `store.add` when a route of the store is added (updating one you have is not counted), and with it
`store.route.<name>`: `<name>` is the route's file name in the store's list without `.walkflow` (`lake-x.walkflow` →
`store.route.lake-x`). It is built only from that list, never from a route you made or imported.

`run.*` is counted when a run has started: free training after the belt answered the start, a workout or a route the first
time the screen is redrawn with its program in the countdown or running (in practice at the first step; a start that fails
counts nothing). Like every name it is sent at most once per start of the app, so it says which kinds of run are used, not
how many runs there were. A run in the demo counts too. Nothing about the run itself is sent.

The treadmill: once after a treadmill is connected, `tm.<maker>.<model>` from the manufacturer and model number the treadmill
reports about itself (Device Information), NULs and spaces at the ends stripped, lower case, other spaces as `-`. There is no fixed list; a guard keeps out a string
that is not 1 to 32 characters from `a-z 0-9 . _ - +`, has 5 or more digits or 6 or more hex digits in a row (also when split by `.`, `_`, `-` or `+`),
looks like an address or UUID, or is only digits. A part that is left out is written `unknown` (`tm.<maker>.unknown`,
`tm.unknown.<model>`), and `tm.unknown` is sent when both are left out or `unknown`, or the treadmill reported none. A string
that passes the guard is sent as the treadmill reported it, also a short word of letters. The demo is `tm.demo`.
Never used: the advertised name, the serial number, the Bluetooth address, the firmware. The values name the treadmill's
Bluetooth module, which other treadmills may share; they come from the module's Device Information, never from anything
typed in the app. Nothing is sent when connecting fails.

Level 3, `error.<kind>.v<x.y.z>`: this known error, in this app version, and nothing else (never a message, a stack or a file;
the cause stays in the log, which the person may copy into an issue). The kinds are listed in `src/core/usage/errors.ts`. From the
treadmill library, mapped in `src/ui/live/error-kinds.ts`: the notices `features-unreadable`, `speed-range-unreadable`,
`write-failed`, `start-speed-failed`, `speed-refused`, and the errors `no-gatt`, `not-connected`, `write-timeout`. The app's own:
`connect-failed` (connecting failed without a library code, or with the library's `superseded`, a connection replaced by a newer one; also when the person closes the device chooser),
`connection-lost` (a connection that was up ended and the person did not press Disconnect; so it also counts when something
outside the app ends the connection, such as the system or the browser), `map-style` (the map reported an error, for example
its style could not be loaded), `file-read` (a file you opened or chose could not be read: GPX, route or workout
package, backup; or a GPX file or package was too large to be read; a failed backup read also counts as `unexpected`; a file that was read but has the wrong content does not
count), `store-add` (a route from the route store could not be fetched, did not match the list, could not be read or saved;
a package made for a later version of the app is a refusal and does not count) and `update-failed` (the desktop
app's update ended in an error). And `unexpected`: an exception nobody caught (`error` and `unhandledrejection` of the window).

- `error.features-unreadable.v<x.y.z>`
- `error.speed-range-unreadable.v<x.y.z>`
- `error.write-failed.v<x.y.z>`
- `error.start-speed-failed.v<x.y.z>`
- `error.speed-refused.v<x.y.z>`
- `error.no-gatt.v<x.y.z>`
- `error.not-connected.v<x.y.z>`
- `error.write-timeout.v<x.y.z>`
- `error.connect-failed.v<x.y.z>`
- `error.connection-lost.v<x.y.z>`
- `error.map-style.v<x.y.z>`
- `error.file-read.v<x.y.z>`
- `error.store-add.v<x.y.z>`
- `error.update-failed.v<x.y.z>`
- `error.unexpected.v<x.y.z>`

The platform is `web` for the web build, otherwise the desktop app's system. The version is the app's version, and only a
plain `x.y.z` (a pre-release sends nothing). The product page is counted separately, by its own pixel (`site.en`, `site.de`: an image without a script or a cookie);
it is not part of the app. `scripts/build-pages.mjs` fills the pixel's address from `WALKFLOW_USAGE` like the app build
does; without it the pages carry no pixel and no small print about counting.

## Never sent

Speed, incline, distance, duration, heart rate, times, places, your own routes and workouts, the name of your treadmill as it
advertises itself, its Bluetooth address, serial numbers, firmware, error texts or stack traces, the values of your settings,
anything you typed.
