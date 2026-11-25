// The limit and maximum-change fields in settings → safety. A type="number" field drops "4,5" when the browser's locale
// uses a decimal point (the app then reads an empty value), so these are text fields that show the language's decimal
// separator and read back either separator.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../../index.html?raw';
import { decideLimitChange, parseMaxStep } from '../../core/safety/limit-settings';
import { LANGS, messagesFor } from '../../i18n/i18n';
import { setUnits, speedFieldText, speedFromInput } from '../../i18n/units';
import { setupSpeedControls, type SpeedControlsHost } from './speed-controls';

afterEach(() => setUnits('metric'));

const inputTag = (id: string) => indexHtml.match(new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';

describe('limit fields in index.html', () => {
  for (const id of ['cap', 'maxStep']) {
    it(`#${id} is a decimal text field, not type="number"`, () => {
      const tag = inputTag(id);
      expect(tag).not.toBe('');
      expect(tag).toMatch(/type="text"/);
      expect(tag).toMatch(/inputmode="decimal"/);
      expect(tag).not.toMatch(/type="number"/);
    });
  }
});

describe('speedFieldText', () => {
  it('writes the decimal separator of the language', () => {
    expect(speedFieldText(4.5, messagesFor('en').number)).toBe('4.5');
    expect(speedFieldText(4.5, messagesFor('de').number)).toBe('4,5');
    expect(speedFieldText(6, messagesFor('de').number)).toBe('6');
  });

  it('is read back to the same limit and step in every language and unit system', () => {
    for (const system of ['metric', 'imperial'] as const) {
      setUnits(system);
      for (const l of LANGS) {
        const n = messagesFor(l).number;
        for (const limit of [1, 4.5, 6, 12.5, 20]) {
          const d = decideLimitChange(speedFromInput(speedFieldText(limit, n)), limit);
          expect(d.ok && d.value, `${system} ${l} ${limit}`).toBeCloseTo(limit, 1);
        }
        for (const step of [0.1, 0.5, 1]) {
          expect(parseMaxStep(speedFromInput(speedFieldText(step, n))), `${system} ${l} ${step}`).toBeCloseTo(step, 1);
        }
      }
    }
  });

  it('a value typed with a comma counts, as with a point', () => {
    expect(decideLimitChange(speedFromInput('4,5'), 6)).toMatchObject({ ok: true, value: 4.5 });
    expect(parseMaxStep(speedFromInput('0,3'))).toBe(0.3);
  });
});

// The slider drag in the training view: the end of a drag fires pointerup before the range input's change. The pointerup
// handler must not put the slider back to the old target, or the change that follows asks for the old speed (or none) and
// the belt does not follow the drag. No DOM library in the tests, so a few fake elements stand in for index.html.

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

function setupDom() {
  elements = {};
  win = new FakeElement();
  vi.stubGlobal('document', {
    getElementById: (id: string) => (elements[id] ??= new FakeElement()),
    querySelectorAll: () => [],
  });
  vi.stubGlobal('window', win);
}

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

describe('slider drag', () => {
  beforeEach(setupDom);
  afterEach(() => { vi.unstubAllGlobals(); });

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

  it('with no target, the figure goes back from the preview to the dash when the drag ends without a change', () => {
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
