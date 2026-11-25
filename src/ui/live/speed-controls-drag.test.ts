// The slider drag in the training view: the end of a drag fires pointerup before the range input's change. The pointerup
// handler must not put the slider back to the old target, or the change that follows asks for the old speed (or none) and
// the belt does not follow the drag. No DOM library in the tests, so a few fake elements stand in for index.html.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSpeedControls, type SpeedControlsHost } from './speed-controls';

type Handler = (() => void) | null;

class FakeElement {
  value = '';
  min = '';
  max = '';
  textContent = '';
  title = '';
  disabled = false;
  scrollTop = 0;
  scrollHeight = 0;
  oninput: Handler = null;
  onchange: Handler = null;
  onclick: Handler = null;
  private listeners: Record<string, (() => void)[]> = {};
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
  dispatch(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
    if (type === 'input') this.oninput?.();
    if (type === 'change') this.onchange?.();
  }
  setAttribute() { /* not needed */ }
  querySelector() { return new FakeElement(); }
}

let elements: Record<string, FakeElement>;
let win: FakeElement;

beforeEach(() => {
  elements = {};
  win = new FakeElement();
  vi.stubGlobal('document', {
    getElementById: (id: string) => (elements[id] ??= new FakeElement()),
    querySelectorAll: () => [],
  });
  vi.stubGlobal('window', win);
});

afterEach(() => { vi.unstubAllGlobals(); });

function setup(target: number | null) {
  const handlers: Record<string, (() => void)[]> = {};
  const state = {
    target, lastCommand: null, ramping: false, connected: true,
    deviceRange: { min: 1, max: 12 }, effectiveMax: 6, maxStep: 0.5,
  };
  const setSpeed = vi.fn((kmh: number) => { state.target = kmh; for (const fn of handlers.target ?? []) fn(); });
  const tm = {
    state, setSpeed, changeSpeed: vi.fn(), setLimits: vi.fn(),
    on: (ev: string, fn: () => void) => { (handlers[ev] ??= []).push(fn); },
  } as unknown as SpeedControlsHost['tm'];
  const controls = setupSpeedControls({ tm, limitsChanged: () => {}, limitSet: () => {} });
  controls.applyLimits();
  return { setSpeed, slider: elements.slider!, figure: elements.target! };
}

describe('slider drag while a target is set', () => {
  it('pointerup and then change asks for the dragged speed, not the old target', () => {
    const { setSpeed, slider } = setup(4);
    expect(slider.value).toBe('4');
    slider.dispatch('pointerdown');
    slider.value = '2.5';
    slider.dispatch('input');
    win.dispatch('pointerup');
    expect(slider.value).toBe('2.5');
    slider.dispatch('change');
    expect(setSpeed).toHaveBeenCalledWith(2.5);
  });

  it('a drag that ends on its starting value shows the target again, and asks for nothing', () => {
    const { setSpeed, slider, figure } = setup(4);
    const before = figure.textContent;
    slider.dispatch('pointerdown');
    slider.value = '5';
    slider.dispatch('input');
    slider.value = '4';
    slider.dispatch('input');
    win.dispatch('pointerup');
    expect(figure.textContent).toBe(before);
    expect(setSpeed).not.toHaveBeenCalled();
  });
});

describe('slider drag with no target', () => {
  it('the figure goes back from the preview to the dash when the drag ends without a change', () => {
    const { setSpeed, slider, figure } = setup(null);
    expect(figure.textContent).toBe('–');
    slider.dispatch('pointerdown');
    slider.value = '3';
    slider.dispatch('input');
    expect(figure.textContent).not.toBe('–');
    win.dispatch('pointerup');
    expect(figure.textContent).toBe('–');
    expect(setSpeed).not.toHaveBeenCalled();
  });
});
