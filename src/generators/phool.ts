import { halfDropParam, outlineParam, repeatSizeParam } from './commonParams';
import { fillGrid, outlineShapes, tilePosition } from './shapes';
import { SLOT, defineGenerator } from './types';

/**
 * Phool (flower): stepped rosettes with 4 or 8 lens-shaped petals, repeated
 * on a (half-drop) grid, with small leaves where the flowers meet.
 */
export const phool = defineGenerator({
  id: 'phool',
  name: 'Phool (flower)',
  about:
    'Rows of stepped flowers. Petals are lens shapes; on a thread grid their curves become small steps. ' +
    'Flower fields are among the most common patola body designs.',
  params: [
    repeatSizeParam(26, [18, 40]),
    {
      key: 'petals',
      type: 'select',
      label: 'Petals',
      default: '8',
      options: [
        { value: '4', label: 'Four' },
        { value: '8', label: 'Eight' },
      ],
    },
    {
      key: 'petalLength',
      type: 'float',
      label: 'Petal length',
      min: 0.4,
      max: 1,
      step: 0.01,
      default: 0.9,
      random: [0.6, 1],
    },
    {
      key: 'petalWidth',
      type: 'float',
      label: 'Petal width',
      min: 1,
      max: 6,
      step: 0.1,
      default: 2.6,
      random: [1.8, 4.5],
    },
    { key: 'centre', type: 'int', label: 'Centre size', min: 1, max: 6, default: 2, random: [1, 4] },
    halfDropParam(true),
    {
      key: 'leaves',
      type: 'int',
      label: 'Corner leaves',
      min: 0,
      max: 6,
      default: 2,
      help: 'Small diamonds between flowers (0 = none)',
    },
    outlineParam(),
  ],

  generate(params, { width, height }): Uint8Array {
    const repeat = params.repeat;
    const radius = repeat / 2;
    const centreSize = params.centre;
    const petalWidth = params.petalWidth;
    const petalLength = Math.max(centreSize + 2, params.petalLength * (radius - 0.5));
    const diagonalPetalLength = Math.max(centreSize + 2, petalLength * 0.75);
    const leafSize = params.leaves;

    // Lens-shaped petal: zero width at both ends, widest in the middle.
    const inPetal = (along: number, across: number, length: number, maxWidth: number): boolean => {
      const progress = (along - centreSize) / (length - centreSize);
      if (progress < 0 || progress > 1) return false;
      return across <= maxWidth * Math.pow(Math.sin(Math.PI * progress), 0.7) + 0.25;
    };

    const grid = fillGrid(width, height, (x, y) => {
      const { dx, dy } = tilePosition(x, y, repeat, repeat, params.halfDrop);
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const distance = absX + absY;

      if (distance <= centreSize) return distance <= centreSize / 2 ? SLOT.secondary : SLOT.accent;
      // Petals on the axes: the longer coordinate runs along the petal.
      if (inPetal(Math.max(absX, absY), Math.min(absX, absY), petalLength, petalWidth)) return SLOT.primary;
      const alongDiagonal = (absX + absY) / Math.SQRT2;
      const acrossDiagonal = Math.abs(absX - absY) / Math.SQRT2;
      if (params.petals === '8' && inPetal(alongDiagonal, acrossDiagonal, diagonalPetalLength, petalWidth * 0.8))
        return SLOT.secondary;
      // Leaves at the tile corners, between neighbouring flowers.
      if (leafSize > 0 && radius - absX + (radius - absY) <= leafSize) return SLOT.accent;
      return SLOT.ground;
    });

    return params.outline ? outlineShapes(grid, width, height) : grid;
  },
});
