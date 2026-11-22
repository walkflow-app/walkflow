#!/usr/bin/env node
// A guided session at the treadmill (skill hardware-check, mode C): an agent prepares the build and follows the app's log
// while the maintainer does the steps, so nobody has to copy a log.
//
//   node scripts/hardware-session.mjs serve <git ref | pull request number> [--port 4173]
//       builds that commit in a worktree of its own and serves it on http://localhost:<port>/ until stopped
//   node scripts/hardware-session.mjs chrome <url> [--debug-port 9222]
//       opens the url (with ?lang=en, so the log reads as in HARDWARE-TESTS.md) in a Chrome with a profile of its own
//   node scripts/hardware-session.mjs watch [<log file>] [--debug-port 9222]
//       appends every new line of the Log card, console warnings and errors and uncaught exceptions to the file (default
//       session-<date>.log), until stopped; on its first attach to a local build it drops the service worker and its cache
//       and loads the page again. It follows the first tab with the app: keep one.
//
// Everything lives in $WALKFLOW_HARDWARE_DIR (default: walkflow-hardware in the temp folder): build/ (the worktree),
// chrome-profile/, the log files. Chrome: $CHROME, else the macOS default; the debug port exists only in a Chrome this script
// started. Node 22 or later (WebSocket). Only for a person at the treadmill: nothing here sends anything to the belt.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(process.env.WALKFLOW_HARDWARE_DIR ?? join(tmpdir(), 'walkflow-hardware'));
const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
// The words that are neither a flag nor a flag's value
const [command, arg] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
const run = (cmd, args, cwd = repo) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

mkdirSync(work, { recursive: true });
if (command === 'serve' && arg) serve(arg, option('port', '4173'));
else if (command === 'chrome' && arg) chrome(arg, option('debug-port', '9222'));
else if (command === 'watch') await watch(resolve(arg ?? join(work, `session-${new Date().toISOString().slice(0, 10)}.log`)), option('debug-port', '9222'));
else {
  console.error('usage: hardware-session.mjs serve <ref | PR number> | chrome <url> | watch [<log file>]');
  process.exit(2);
}

function serve(ref, port) {
  let commit = ref;
  if (/^\d+$/.test(ref)) {
    run('git', ['fetch', 'origin', `pull/${ref}/head`]);
    commit = 'FETCH_HEAD';
  }
  const sha = execFileSync('git', ['rev-parse', '--short', commit], { cwd: repo }).toString().trim();
  const dir = join(work, 'build');
  if (existsSync(dir)) run('git', ['checkout', '--detach', sha], dir);
  else run('git', ['worktree', 'add', '--detach', dir, sha]);
  run('npm', ['ci', '--no-audit', '--no-fund'], dir);
  run('npx', ['vite', 'build'], dir);
  console.log(`\nserving ${ref} (${sha}) on http://localhost:${port}/`);
  const server = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { cwd: dir, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.kill(); process.exit(0); });
}

function chrome(url, debugPort) {
  const target = new URL(url);
  if (!target.searchParams.has('lang')) target.searchParams.set('lang', 'en');
  spawn(chromePath, [
    `--user-data-dir=${join(work, 'chrome-profile')}`, `--remote-debugging-port=${debugPort}`,
    '--no-first-run', '--no-default-browser-check', '--new-window', target.href,
  ], { detached: true, stdio: 'ignore' }).unref();
  console.log(`Chrome opened ${target.href}`);
}

async function watch(file, debugPort) {
  const out = line => appendFileSync(file, `${new Date().toTimeString().slice(0, 8)} ${line}\n`);
  console.log(`writing to ${file}`);
  out('--- watching');
  let fresh = true;
  for (;;) {
    try {
      await follow(debugPort, out, fresh);
      fresh = false;
    } catch (e) {
      out(`--- ${e.message}, trying again`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

// One connection to the app's tab, until the tab or Chrome goes away. On the first one, a local build drops the service
// worker and its cache and loads again: the same port may still hold an older build.
async function follow(debugPort, out, fresh) {
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const page = targets.find(t => t.type === 'page' && /walkflow|localhost|127\.0\.0\.1/.test(t.url));
  if (!page) throw new Error('no tab with the app yet');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise(done => {
    pending.set(++id, done);
    ws.send(JSON.stringify({ id, method, params }));
  });
  let seen = 0; // characters of the Log card already written
  await new Promise((done, fail) => {
    ws.onopen = done;
    ws.onerror = () => fail(new Error('cannot attach to the tab'));
  });
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    } else if (m.method === 'Runtime.consoleAPICalled' && ['warning', 'error', 'assert'].includes(m.params.type)) {
      out(`[console.${m.params.type}] ${m.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`);
    } else if (m.method === 'Runtime.exceptionThrown') {
      out(`[exception] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    } else if (m.method === 'Page.frameNavigated' && !m.params.frame.parentId) {
      seen = 0;
      out(`--- page loaded: ${m.params.frame.url}`);
    }
  };
  const closed = new Promise(done => {
    ws.onclose = () => {
      for (const answer of pending.values()) answer(undefined);
      pending.clear();
      done();
    };
  });
  out(`--- attached: ${page.url}`);
  await send('Runtime.enable');
  await send('Page.enable');
  const origin = new URL(page.url).origin;
  if (fresh && /localhost|127\.0\.0\.1/.test(origin)) {
    await send('Storage.clearDataForOrigin', { origin, storageTypes: 'service_workers,cache_storage' });
    await send('Page.reload', { ignoreCache: true });
    out('--- local build: service worker and cache dropped, page loaded again');
  }
  const read = async () => {
    const r = await send('Runtime.evaluate', {
      expression: `document.getElementById('log')?.textContent ?? ''`, returnByValue: true,
    });
    if (typeof r?.result?.value !== 'string') return; // the page is loading
    const text = r.result.value;
    if (text.length < seen) seen = 0;
    for (const line of text.slice(seen).split('\n').filter(Boolean)) out(`[app] ${line}`);
    seen = text.length;
  };
  const poll = setInterval(() => void read(), 500);
  await closed;
  clearInterval(poll);
  out('--- detached');
}
