import { halfDropParam } from './commonParams';
import { fillGrid, tilePosition } from './shapes';
import { SLOT, defineGenerator } from './types';

const SLOT_BY_LEVEL = [SLOT.primary, SLOT.secondary, SLOT.accent, SLOT.primary, SLOT.secondary, SLOT.accent];

/**
 * Ratan chowk (jewel square): squares with nested shapes inside. In "alternate"
 * style a diamond sits inside the square, a square inside the diamond, and so on;
 * in "concentric" style the squares shrink evenly.
 */
export const ratanChowk = defineGenerator({
  id: 'ratan-chowk',
  name: 'Ratan chowk (jewel square)',
  about:
    'A grid of squares, each holding nested squares and diamonds like a set jewel. ' +
    'Alternating squares and diamonds is a frequent patola device.',
  params: [
    { key: 'size', type: 'int', label: 'Square size', min: 8, max: 64, default: 26, random: [16, 40] },
    {
      key: 'gap',
      type: 'int',
      label: 'Gap',
      min: 0,
      max: 6,
      default: 2,
      help: 'Ground-coloured lines between squares',
    },
    { key: 'levels', type: 'int', label: 'Nesting', min: 1, max: 6, default: 3, random: [2, 5] },
    {
      key: 'style',
      type: 'select',
      label: 'Style',
      default: 'alternate',
      options: [
        { value: 'alternate', label: 'Square ↔ diamond' },
        { value: 'concentric', label: 'Concentric squares' },
      ],
    },
    { key: 'lines', type: 'bool', label: 'Outlines', default: true },
    halfDropParam(false),
  ],

  generate(params, { width, height }): Uint8Array {
    const squareSize = params.size;
    const outerRadius = squareSize / 2 - params.gap;
    const levelCount = params.levels;
    const alternate = params.style === 'alternate';

    return fillGrid(width, height, (x, y) => {
      const { dx, dy } = tilePosition(x, y, squareSize, squareSize, params.halfDrop);
      const squareDistance = Math.max(Math.abs(dx), Math.abs(dy));
      const diamondDistance = Math.abs(dx) + Math.abs(dy);
      if (squareDistance > outerRadius) return SLOT.ground;

      // Walk inwards through the nested shapes; remember the innermost one this cell is in.
      let slot: number = SLOT_BY_LEVEL[0];
      let onEdge = squareDistance > outerRadius - 1;
      let radius = outerRadius;
      let currentIsSquare = true;
      for (let level = 1; level < levelCount; level++) {
        let distance: number;
        if (alternate) {
          // A diamond inscribed in a square keeps the radius; a square inscribed in a diamond halves it.
          if (!currentIsSquare) radius /= 2;
          distance = currentIsSquare ? diamondDistance : squareDistance;
          currentIsSquare = !currentIsSquare;
        } else {
          radius = outerRadius * (1 - level / levelCount);
          distance = squareDistance;
        }
        if (radius < 1 || distance > radius) break;
        slot = SLOT_BY_LEVEL[level];
        onEdge = distance > radius - 1;
      }
      return params.lines && onEdge ? SLOT.outline : slot;
    });
  },
});
