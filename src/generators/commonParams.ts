/** Parameter definitions shared by several generators. */
import type { BoolParam, NumberParam, Params, SelectParam } from '../core/params';
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

/** Repeating one motif (pictures, symbols, wheels): ground between repeats. */
export const MOTIF_GAP_PARAM: NumberParam<'gap'> = {
  key: 'gap',
  type: 'int',
  label: 'Spacing',
  min: 0,
  max: 60,
  default: 6,
  random: [2, 14],
  help: 'Ground between repeats, in cells',
};

export const MOTIF_ARRANGEMENT_PARAM: SelectParam<'arrangement'> = {
  key: 'arrangement',
  type: 'select',
  label: 'Arrangement',
  default: 'halfDrop',
  options: [
    { value: 'grid', label: 'Grid' },
    { value: 'halfDrop', label: 'Half-drop' },
    { value: 'single', label: 'Single, centred' },
  ],
};

export const MIRROR_ALTERNATE_PARAM: BoolParam<'mirror'> = {
  key: 'mirror',
  type: 'bool',
  label: 'Mirror alternate',
  default: true,
  help: 'Every other column faces the other way, so figures face each other',
};

/** Which palette colours a motif uses: 0 as drawn, 1 and 2 rotate primary → secondary → accent. */
export const COLOURWAY_PARAM: NumberParam<'colourway'> = {
  key: 'colourway',
  type: 'int',
  label: 'Colourway',
  min: 0,
  max: 2,
  default: 0,
  help: 'Shift which palette colours the motif uses',
};

/** A motif slot in a colourway: primary, secondary and accent rotate by `shift`; others stay. */
export function colourwaySlot(slot: number, shift: number): number {
  return slot >= 1 && slot <= 3 ? ((slot - 1 + shift) % 3) + 1 : slot;
}
