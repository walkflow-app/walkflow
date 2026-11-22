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
| 2 Improve | Which functions are used | "Improve", on unless switched off |
| 3 Errors | Which known error happened, in which version | "Errors", on unless switched off |

The two switches are the only thing stored for the counts: `walkflow.usageImprove` and `walkflow.usageErrors`, where
absent means on and `0` means off. The switches come to the settings with a later version; until then levels 2 and 3 count
as on.

## Names

Level 1:

- `app.<web|win|mac|linux>.v<x.y.z>`

Level 2:

- `lang.en`
- `lang.de`
- `lang.fr`
- `lang.uk`

Level 3, `error.<kind>.v<x.y.z>`: this known error, in this app version, and nothing else (never a message, a stack or a file;
the cause stays in the log, which the person may copy into an issue). The kinds (`src/core/usage/errors.ts`). From the
treadmill library, mapped in `src/ui/live/error-kinds.ts`: the notices `features-unreadable`, `speed-range-unreadable`,
`write-failed`, `start-speed-failed`, `speed-refused`, and the errors `no-gatt`, `not-connected`, `write-timeout`. The app's own:
`connect-failed` (connecting failed without a library code; also when the person closes the device chooser),
`connection-lost` (a connection that was up ended and the person did not press Disconnect), and `map-style`, `file-read`,
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
