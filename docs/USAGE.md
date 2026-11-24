# Anonymous usage counts

Walkflow counts anonymously how often it is used, to improve it. This page lists every name the app can send and what is
never sent. The names are built by the code from fixed parts (`src/core/usage/events.ts`); nothing typed, measured or
identifying is ever part of one. A test (`tests/usage-docs.test.ts`) keeps the lists below equal to the code.

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

## Levels

| Level | What | Switch |
| --- | --- | --- |
| 1 Used | The app was started: platform and version | none |
| 2 Improve | Which functions are used | "Help to improve by sharing anonymously which features I use" (internal name Improve), on unless switched off |
| 3 Errors | Which known error happened, in which version (comes with the error codes) | "Share errors anonymously" (internal name Errors), on unless switched off |

The two switches are the only thing stored for the counts: `walkflow.usageImprove` and `walkflow.usageErrors`, where
absent means on and `0` means off. The switches are in the settings, Info tab, section "Usage data", which also says what is
sent and where it goes (without a counter in the build it says that nothing is sent and shows no switches). The first-start
popup carries a short notice that points there.

## Names

Level 1:

- `app.<web|win|mac|linux>.v<x.y.z>`

Level 2:

- `lang.en`
- `lang.de`
- `lang.fr`
- `lang.uk`
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

When they are sent: a view name when the view is opened (the Community view counts nothing; `view.training` comes at nearly every
start, because Training is the view the app opens on). `workout.interval` when a new
workout is saved in the editor, `workout.weekplan` when the week plan is saved, `workout.import` when a workout package is
imported. `route.own` when the walking speed or description of a route is saved, `route.gpx` when a GPX file is imported,
`route.map-on` when the map is switched on. `history.csv` and `history.tcx` when the recording is exported. `store.open` when
the route store is opened. `store.add` when a route of the store is added (updating one you have is not counted), and with it
`store.route.<name>`: `<name>` is the route's file name in the store's list without `.walkflow` (`lake-x.walkflow` →
`store.route.lake-x`). It is built only from that list, never from a route you made or imported.

Level 3, `error.<kind>.v<x.y.z>`: this known error, in this app version, and nothing else (never a message, a stack or a file;
the cause stays in the log, which the person may copy into an issue). The kinds are listed in `src/core/usage/errors.ts`. From the
treadmill library, mapped in `src/ui/live/error-kinds.ts`: the notices `features-unreadable`, `speed-range-unreadable`,
`write-failed`, `start-speed-failed`, `speed-refused`, and the errors `no-gatt`, `not-connected`, `write-timeout`. The app's own:
`connect-failed` (connecting failed without a library code; also when the person closes the device chooser),
`connection-lost` (a connection that was up ended and the person did not press Disconnect; so it also counts when something
outside the app ends the connection, such as the system or the browser), and `map-style`, `file-read`,
`store-add`, `update-failed`, which are listed already but only sent from a later version. And `unexpected`: an exception nobody caught
(`error` and `unhandledrejection` of the window).

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
plain `x.y.z` (a pre-release sends nothing). The product page will be counted separately, by its own pixel (`site.en`, `site.de`); it is not part of the app.

## Never sent

Speed, incline, distance, duration, heart rate, times, places, your own routes and workouts, the name of your treadmill as it
advertises itself, its Bluetooth address, serial numbers, firmware, error texts or stack traces, the values of your settings,
anything you typed.
