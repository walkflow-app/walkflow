// What a key does while a treadmill is connected (src/ui/live/controls.ts acts on it). Stop is one key away wherever the focus
// is: Esc always stops, Space stops except where it types a space. The arrows change the speed only in the training view,
// outside fields, dialogs and the map (where they pan), and a held arrow is one step: a repeat would walk the belt up to the
// limit.

export interface KeyInput {
  key: string;
  code: string;
  /** tagName of the element with the focus */
  tag: string;
  /** type of an INPUT, else '' */
  type: string;
  repeat: boolean;
  view: string;
  /** The focus is inside an open dialog */
  inDialog: boolean;
  /** The focus is on the map */
  onMap: boolean;
  /** The focus is in an element that takes text (contenteditable) */
  editable?: boolean;
}

export type KeyAction = 'stop' | 'faster' | 'slower' | null;

/** Input types where Space types a space */
const TEXT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password', 'date', 'time', 'datetime-local', 'month', 'week', '']);

const takesText = (k: KeyInput): boolean =>
  k.editable === true || k.tag === 'TEXTAREA' || (k.tag === 'INPUT' && TEXT_TYPES.has(k.type));

export function keyAction(k: KeyInput): KeyAction {
  if (k.key === 'Escape') return 'stop';
  if (k.code === 'Space') return takesText(k) ? null : 'stop';
  if (k.key !== 'ArrowUp' && k.key !== 'ArrowDown') return null;
  if (k.repeat || k.view !== 'training' || k.inDialog || k.onMap) return null;
  if (k.tag === 'INPUT' || k.tag === 'SELECT' || k.tag === 'TEXTAREA' || k.editable === true) return null;
  return k.key === 'ArrowUp' ? 'faster' : 'slower';
}
