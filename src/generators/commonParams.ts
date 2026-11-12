/** Parameter definitions shared by several generators. */
import type { BoolParam, NumberParam, Params } from '../core/params';
import type { Size } from '../layouts/types';

const REPEAT_MIN = 8;
const REPEAT_MAX = 80;

export function repeatSizeParam(
  defaultSize: number,
  randomRange: [number, number],
  help = 'Size of one repeat, in design cells',
): NumberParam<'repeat'> {
  return {
    key: 'repeat',
    type: 'int',
    label: 'Repeat size',
    min: REPEAT_MIN,
    max: REPEAT_MAX,
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

/** Settings that zones holding one motif (see ZoneDef.oneMotif) decide themselves. */
export const ONE_MOTIF_KEYS: readonly string[] = ['repeat', 'halfDrop'];

/**
 * Settings that put one whole motif, centred, in a zone of `size`: the repeat
 * matches the zone and there is no half-drop. Settings a generator lacks stay absent.
 */
export function oneMotifParams(params: Params, size: Size): Params {
  const fitted = { ...params };
  if ('repeat' in fitted) fitted.repeat = Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, Math.min(size.width, size.height)));
  if ('halfDrop' in fitted) fitted.halfDrop = false;
  return fitted;
}
