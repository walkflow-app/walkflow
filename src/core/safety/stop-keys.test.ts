import { describe, expect, it } from 'vitest';
import { keyAction, type KeyInput } from './stop-keys';

const key = (over: Partial<KeyInput>): KeyInput => ({
  key: '', code: '', tag: 'BODY', type: '', repeat: false, view: 'training', inDialog: false, onMap: false, ...over,
});
const esc = { key: 'Escape', code: 'Escape' };
const space = { key: ' ', code: 'Space' };
const up = { key: 'ArrowUp', code: 'ArrowUp' };
const down = { key: 'ArrowDown', code: 'ArrowDown' };

describe('keyAction (#46)', () => {
  it('Esc always stops: in text fields, selects, checkboxes, dialogs, every view', () => {
    for (const where of [
      {}, { tag: 'INPUT', type: 'text' }, { tag: 'INPUT', type: 'search' }, { tag: 'TEXTAREA' }, { tag: 'SELECT' },
      { tag: 'INPUT', type: 'checkbox' }, { inDialog: true }, { view: 'routes' }, { onMap: true }, { repeat: true },
    ] as Partial<KeyInput>[]) {
      expect(keyAction(key({ ...esc, ...where }))).toBe('stop');
    }
  });

  it('Space stops, except where it types a space', () => {
    expect(keyAction(key(space))).toBe('stop');
    expect(keyAction(key({ ...space, tag: 'SELECT' }))).toBe('stop');
    expect(keyAction(key({ ...space, tag: 'INPUT', type: 'checkbox' }))).toBe('stop');
    expect(keyAction(key({ ...space, tag: 'INPUT', type: 'range' }))).toBe('stop');
    expect(keyAction(key({ ...space, tag: 'BUTTON' }))).toBe('stop');
    expect(keyAction(key({ ...space, view: 'history' }))).toBe('stop');
    expect(keyAction(key({ ...space, tag: 'INPUT', type: 'text' }))).toBeNull();
    expect(keyAction(key({ ...space, tag: 'INPUT', type: 'search' }))).toBeNull();
    expect(keyAction(key({ ...space, tag: 'INPUT', type: 'number' }))).toBeNull();
    expect(keyAction(key({ ...space, tag: 'TEXTAREA' }))).toBeNull();
    expect(keyAction(key({ ...space, editable: true }))).toBeNull();
  });

  it('arrows change the speed only in the training view, outside fields, dialogs and the map', () => {
    expect(keyAction(key(up))).toBe('faster');
    expect(keyAction(key(down))).toBe('slower');
    expect(keyAction(key({ ...up, view: 'routes' }))).toBeNull();
    expect(keyAction(key({ ...up, view: 'history' }))).toBeNull();
    expect(keyAction(key({ ...up, inDialog: true }))).toBeNull();
    expect(keyAction(key({ ...up, onMap: true }))).toBeNull();
    expect(keyAction(key({ ...up, tag: 'INPUT', type: 'range' }))).toBeNull();
    expect(keyAction(key({ ...up, tag: 'SELECT' }))).toBeNull();
  });

  it('a held arrow is one step, not one per repeat', () => {
    expect(keyAction(key({ ...up, repeat: true }))).toBeNull();
    expect(keyAction(key({ ...down, repeat: true }))).toBeNull();
  });

  it('other keys do nothing', () => {
    expect(keyAction(key({ key: 'a', code: 'KeyA' }))).toBeNull();
    expect(keyAction(key({ key: 'Enter', code: 'Enter' }))).toBeNull();
  });
});
