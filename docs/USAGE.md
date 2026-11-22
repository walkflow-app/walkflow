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
| 3 Errors | Which known error happened (comes with the error codes) | "Share errors anonymously" (internal name Errors), on unless switched off |

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

The platform is `web` for the web build, otherwise the desktop app's system. The version is the app's version, and only a
plain `x.y.z` (a pre-release sends nothing). The product page will be counted separately, by its own pixel (`site.en`, `site.de`); it is not part of the app.

## Never sent

Speed, incline, distance, duration, heart rate, times, places, your own routes and workouts, the name of your treadmill as it
advertises itself, its Bluetooth address, serial numbers, firmware, error texts or stack traces, the values of your settings,
anything you typed.
