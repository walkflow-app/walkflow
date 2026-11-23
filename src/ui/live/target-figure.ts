// The Target figure in the training view: the speed the treadmill was asked for. With no target (a first connection, or a
// new connection: ftms-treadmill forgets the speed asked for) Start does not ramp to anything, so the figure shows a dash
// and never the slider's position, which would claim a speed the belt will not be brought to.

export const NO_TARGET_TEXT = '–';

export function targetFigureText(target: number | null, format: (kmh: number) => string): string {
  return target === null ? NO_TARGET_TEXT : format(target);
}
