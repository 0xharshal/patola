import { COLOUR_COUNT_PARAM, halfDropParam, repeatSizeParam } from './commonParams';
import { bandSequence, fillGrid, tilePosition } from './shapes';
import { SLOT, defineGenerator } from './types';

/** Concentric stepped diamonds (or squares / octagons), radiating from each tile centre. */
export const diamonds = defineGenerator({
  id: 'diamonds',
  name: 'Concentric diamonds',
  about:
    'Rings of stepped diamonds spreading out from each centre until they meet their neighbours. ' +
    'Where the rings collide they form a second, interlocking lattice.',
  params: [
    repeatSizeParam(32, [16, 48]),
    { key: 'ring', type: 'int', label: 'Ring width', min: 1, max: 8, default: 2, random: [1, 4] },
    COLOUR_COUNT_PARAM,
    {
      key: 'shape',
      type: 'select',
      label: 'Shape',
      default: 'diamond',
      options: [
        { value: 'diamond', label: 'Diamond' },
        { value: 'square', label: 'Square' },
        { value: 'octagon', label: 'Octagon' },
      ],
    },
    { key: 'centre', type: 'int', label: 'Centre jewel', min: 0, max: 6, default: 2 },
    halfDropParam(false),
  ],

  generate(params, { width, height }): Uint8Array {
    const repeat = params.repeat;
    const ringWidth = params.ring;
    const slots = bandSequence(params.colours);
    const centreSize = params.centre;

    const distanceFor = (absX: number, absY: number): number => {
      if (params.shape === 'square') return Math.max(absX, absY);
      if (params.shape === 'octagon') return Math.max(absX, absY, (absX + absY) * 0.75);
      return absX + absY;
    };

    return fillGrid(width, height, (x, y) => {
      const { dx, dy } = tilePosition(x, y, repeat, repeat, params.halfDrop);
      const distance = distanceFor(Math.abs(dx), Math.abs(dy));
      if (centreSize > 0 && distance <= centreSize) return SLOT.outline;
      return slots[Math.floor(distance / ringWidth) % slots.length];
    });
  },
});
