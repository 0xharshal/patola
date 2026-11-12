import { halfDropParam, outlineParam, repeatSizeParam } from './commonParams';
import { fillGrid, outlineShapes, tilePosition } from './shapes';
import { SLOT, defineGenerator } from './types';

/** Classic heart curve with its point at the bottom (y up): (x² + y² − 1)³ − x²y³ ≤ 0. */
function insideHeart(x: number, y: number): boolean {
  const circleTerm = x * x + y * y - 1;
  return circleTerm * circleTerm * circleTerm - x * x * y * y * y <= 0;
}

/**
 * Pan (peepal leaf): heart-shaped leaves with a long drip tip, a central vein
 * and a stem, repeated in a half-drop grid; alternate columns can point the other way.
 */
export const pan = defineGenerator({
  id: 'pan',
  name: 'Pan (peepal leaf)',
  about:
    'Heart-shaped leaves of the sacred peepal tree, with their long pointed tip. ' +
    'Leaves often alternate direction from one column to the next.',
  params: [
    repeatSizeParam(24, [16, 40]),
    {
      key: 'leafSize',
      type: 'float',
      label: 'Leaf size',
      min: 0.5,
      max: 1,
      step: 0.01,
      default: 0.85,
      random: [0.65, 1],
    },
    halfDropParam(true),
    {
      key: 'alternate',
      type: 'bool',
      label: 'Alternate direction',
      default: true,
      help: 'Flip every other column of leaves',
    },
    { key: 'vein', type: 'bool', label: 'Vein', default: true },
    { key: 'stem', type: 'bool', label: 'Stem', default: true },
    outlineParam(),
  ],

  generate(params, { width, height }): Uint8Array {
    const repeat = params.repeat;
    // Leaf coordinates in leaf half-heights: `across` the leaf, `along` it towards the tip.
    const leafHalfHeight = params.leafSize * repeat * 0.36;
    const oneCell = 1 / leafHalfHeight;
    const onCentreLine = (across: number) => Math.abs(across) <= oneCell * 0.5;

    const grid = fillGrid(width, height, (x, y) => {
      const { dx, dy, column } = tilePosition(x, y, repeat, repeat, params.halfDrop);
      const flipped = params.alternate && (column & 1) === 1;
      const across = dx / leafHalfHeight;
      const along = (flipped ? -dy : dy) / leafHalfHeight + 0.3;

      // Body: a heart (stem notch on top) narrowed so the leaf is taller than wide,
      // plus the long, narrow drip tip that makes a peepal leaf recognisable.
      const inBody = insideHeart(across * 1.5, -along * 1.05 + 0.1);
      const inTip = along >= 0.9 && along <= 1.75 && Math.abs(across) <= 0.16 * ((1.75 - along) / 0.85) + oneCell * 0.5;
      if (inBody || inTip) return params.vein && onCentreLine(across) && along > -0.75 ? SLOT.secondary : SLOT.primary;
      if (params.stem && onCentreLine(across) && along >= -1.15 && along < -0.6) return SLOT.secondary;
      return SLOT.ground;
    });

    return params.outline ? outlineShapes(grid, width, height) : grid;
  },
});
