// What the person presses to start, pause and stop: the buttons, the stop bar in the other views, and the keys (Esc always
// stops, Space too outside text fields, ↑ ↓ change the speed in the training view; src/core/safety/stop-keys.ts decides).
// Stop is never held back: no question, no waiting for anything but the command itself.

import type { Active } from '../../core/training/selection';
import type { ProgramRunner } from '../../core/training/program';
import { keyAction } from '../../core/safety/stop-keys';
import { $button } from '../ui';
import { startFree, type Count } from './run-count';

export interface ControlsHost {
  connected(): boolean;
  runner: Pick<ProgramRunner, 'active'>;
  /** What Start starts: a workout, a route or nothing (free training) */
  stage: {
    effectiveActive(): Active;
    runProgram(): Promise<void>;
    runRoute(): Promise<void>;
    setActive(kind: Active): void;
  };
  belt: { start(): Promise<boolean>; stop(): Promise<boolean>; pause(): Promise<boolean> };
  speed: { step(direction: 1 | -1): void };
  /** The question before a start */
  confirmStart(): Promise<boolean>;
  /** The usage count (a run started); read-only */
  count: Count;
}

/** What a key press says about where it happened; plain values, so a test needs no DOM */
export interface KeyTarget { tag: string; type: string; editable: boolean; onMap: boolean }
export interface KeyEventLike {
  key: string;
  code: string;
  repeat: boolean;
  /** Read only after the Esc check: nothing may throw before that stop */
  target(): KeyTarget;
  preventDefault(): void;
}
/** What the page says: not the focus, the page (after a stop the focus may have left the dialog that is still open) */
export interface KeyPage {
  dialogOpen(): boolean;
  view(): string;
  blurFocus(): void;
}

/** The handlers of the buttons; the same functions the bound buttons call (ui/live/belt.test.ts calls them too) */
export function controlHandlers(host: Pick<ControlsHost, 'belt'>) {
  return {
    pause: () => void host.belt.pause(),
    stop: () => void host.belt.stop(),
    sbStop: () => void host.belt.stop(),
  };
}

/** The keydown handler: Esc and Space stop, the arrows change the speed (the decision is src/core/safety/stop-keys.ts) */
export function keydownHandler(host: Pick<ControlsHost, 'connected' | 'belt' | 'speed'>, page: KeyPage): (e: KeyEventLike) => void {
  return e => {
    if (!host.connected()) return;
    // Esc stops before anything else is looked at: nothing may throw before this stop
    if (e.key === 'Escape') {
      // In a dialog Esc also cancels it as usual (preventing it would keep the dialog open)
      if (!page.dialogOpen()) e.preventDefault();
      void host.belt.stop();
      return;
    }
    const action = keyAction({
      key: e.key, code: e.code, tag: e.target().tag, type: e.target().type, repeat: e.repeat,
      view: page.view(),
      inDialog: page.dialogOpen(),
      onMap: e.target().onMap,
      editable: e.target().editable,
    });
    if (action === 'stop') {
      e.preventDefault();
      void host.belt.stop();
      page.blurFocus();
    } else if (action !== null) {
      e.preventDefault();
      host.speed.step(action === 'faster' ? 1 : -1);
    }
  };
}

export function setupControls(host: ControlsHost) {
  $button('start').onclick = async () => {
    // A program that is running is not started again; stop it first
    if (host.runner.active) return;
    const kind = host.stage.effectiveActive();
    if (kind === 'workout') { await host.stage.runProgram(); return; }
    if (kind === 'route') { await host.stage.runRoute(); return; }
    if (!(await host.confirmStart())) return;
    if (host.connected()) await startFree(() => host.belt.start(), host.count);
  };
  $button('shClear').onclick = () => host.stage.setActive(null);
  const h = controlHandlers(host);
  $button('pause').onclick = h.pause;
  $button('stop').onclick = h.stop;
  $button('sbStop').onclick = h.sbStop;

  const onKey = keydownHandler(host, {
    dialogOpen: () => document.querySelector('dialog[open]') !== null,
    view: () => document.documentElement.dataset.view ?? 'training',
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- the focus may be on an element without blur()
    blurFocus: () => (document.activeElement as HTMLElement | null)?.blur?.(),
  });
  document.addEventListener('keydown', e => {
    onKey({
      key: e.key, code: e.code, repeat: e.repeat, preventDefault: () => e.preventDefault(),
      target: () => {
        const el = e.target instanceof HTMLElement ? e.target : document.body;
        return {
          tag: el.tagName, type: el instanceof HTMLInputElement ? el.type : '',
          editable: el.isContentEditable, onMap: el.closest('.route-map, .maplibregl-map') !== null,
        };
      },
    });
  });
}
