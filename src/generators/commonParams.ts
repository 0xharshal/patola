/** Parameter definitions shared by several generators. */
import type { BoolParam, NumberParam } from '../core/params';

export function repeatSizeParam(
  defaultSize: number,
  randomRange: [number, number],
  help = 'Size of one repeat, in design cells',
): NumberParam<'repeat'> {
  return {
    key: 'repeat',
    type: 'int',
    label: 'Repeat size',
    min: 8,
    max: 80,
    default: defaultSize,
    random: randomRange,
    help,
  };
}

export function halfDropParam(defaultOn: boolean): BoolParam<'halfDrop'> {
  return {
    key: 'halfDrop',
    type: 'bool',
    label: 'Half-drop',
    default: defaultOn,
    help: 'Shift every other column of repeats down by half',
  };
}

export function outlineParam(defaultOn = true, label = 'Outline'): BoolParam<'outline'> {
  return { key: 'outline', type: 'bool', label, default: defaultOn, help: 'Dark contour around shapes' };
}

export const COLOUR_COUNT_PARAM: NumberParam<'colours'> = {
  key: 'colours',
  type: 'int',
  label: 'Colours',
  min: 2,
  max: 5,
  default: 4,
  help: 'How many palette colours the bands cycle through',
};
