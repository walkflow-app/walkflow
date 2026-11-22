// What the person presses to start, pause and stop: the buttons, the stop bar in the other views, and the keys (Esc always
// stops, Space too outside text fields, ↑ ↓ change the speed in the training view; src/core/safety/stop-keys.ts decides).
// Stop is never held back: no question, no waiting for anything but the command itself.

import type { Active } from '../../core/training/selection';
import type { ProgramRunner } from '../../core/training/program';
import { keyAction } from '../../core/safety/stop-keys';
import { $button } from '../ui';

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
}

export function setupControls(host: ControlsHost) {
  $button('start').onclick = async () => {
    // A program that is running is not started again; stop it first
    if (host.runner.active) return;
    const kind = host.stage.effectiveActive();
    if (kind === 'workout') { await host.stage.runProgram(); return; }
    if (kind === 'route') { await host.stage.runRoute(); return; }
    if (!(await host.confirmStart())) return;
    if (host.connected()) await host.belt.start();
  };
  $button('shClear').onclick = () => host.stage.setActive(null);
  $button('pause').onclick = () => void host.belt.pause();
  $button('stop').onclick = () => void host.belt.stop();
  $button('sbStop').onclick = () => void host.belt.stop();

  document.addEventListener('keydown', e => {
    if (!host.connected()) return;
    // Esc stops before anything else is looked at: nothing may throw before this stop
    if (e.key === 'Escape') {
      // In a dialog Esc also cancels it as usual (preventing it would keep the dialog open)
      if (document.querySelector('dialog[open]') === null) e.preventDefault();
      void host.belt.stop();
      return;
    }
    const el = e.target instanceof HTMLElement ? e.target : document.body;
    const action = keyAction({
      key: e.key, code: e.code, tag: el.tagName, type: el instanceof HTMLInputElement ? el.type : '', repeat: e.repeat,
      view: document.documentElement.dataset.view ?? 'training',
      // The page, not the focus: after a stop the focus may have left the dialog that is still open
      inDialog: document.querySelector('dialog[open]') !== null,
      onMap: el.closest('.route-map, .maplibregl-map') !== null,
      editable: el.isContentEditable,
    });
    if (action === 'stop') {
      e.preventDefault();
      void host.belt.stop();
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- the focus may be on an element without blur()
      (document.activeElement as HTMLElement | null)?.blur?.();
    } else if (action !== null) {
      e.preventDefault();
      host.speed.step(action === 'faster' ? 1 : -1);
    }
  });
}
