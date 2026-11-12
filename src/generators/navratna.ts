import { repeatSizeParam, halfDropParam } from './commonParams';
import { fillGrid, tilePosition } from './shapes';
import { SLOT, defineGenerator } from './types';

/**
 * Navratna ("nine jewels"): a lattice of stepped diamonds. Inside each diamond,
 * concentric bands surround a centre of nine small jewels (or a flower).
 * Between the diamonds, smaller diamonds form where four corners meet.
 *
 * Shapes use Manhattan distance (|dx| + |dy|), which naturally gives the
 * stepped diagonals of tie-dyed thread grids.
 */
export const navratna = defineGenerator({
  id: 'navratna',
  name: 'Navratna (nine jewels)',
  about:
    'A lattice of stepped diamonds, each holding nine small "jewels". One of the classic Patan patola field designs. ' +
    'The diagonals are stepped because each cell is a bundle of threads tied and dyed before weaving.',
  params: [
    repeatSizeParam(32, [20, 48], 'Width of one diamond, in design cells'),
    halfDropParam(false),
    { key: 'outline', type: 'int', label: 'Outline width', min: 0, max: 4, default: 1 },
    {
      key: 'rings',
      type: 'int',
      label: 'Bands',
      min: 0,
      max: 4,
      default: 1,
      help: 'Concentric bands inside each diamond',
    },
    { key: 'ringWidth', type: 'int', label: 'Band width', min: 1, max: 5, default: 2 },
    {
      key: 'centre',
      type: 'select',
      label: 'Centre',
      default: 'jewels',
      options: [
        { value: 'jewels', label: 'Nine jewels' },
        { value: 'flower', label: 'Flower' },
        { value: 'plain', label: 'Plain' },
      ],
    },
    { key: 'jewelSize', type: 'int', label: 'Jewel size', min: 1, max: 5, default: 2 },
    {
      key: 'cornerJewel',
      type: 'bool',
      label: 'Corner jewels',
      default: true,
      help: 'Small diamonds where four large diamonds meet',
    },
  ],

  generate(params, { width, height }): Uint8Array {
    const diamondSize = params.repeat;
    const radius = diamondSize / 2;
    const outlineWidth = params.outline;
    const bandCount = params.rings;
    const bandWidth = params.ringWidth;
    const jewelSize = params.jewelSize;
    const innerRadius = radius - outlineWidth;
    // The eight outer jewels sit on a diamond ring; keep its radius even so the
    // diagonal jewels land on whole cells.
    const jewelRing = Math.max(2, 2 * Math.round((innerRadius * 0.62) / 2));
    const half = jewelRing / 2;
    const jewelCentres: [number, number][] = [
      [0, 0],
      [jewelRing, 0],
      [-jewelRing, 0],
      [0, jewelRing],
      [0, -jewelRing],
      [half, half],
      [-half, half],
      [half, -half],
      [-half, -half],
    ];

    return fillGrid(width, height, (x, y) => {
      const { dx, dy } = tilePosition(x, y, diamondSize, diamondSize, params.halfDrop);
      const distance = Math.abs(dx) + Math.abs(dy);

      if (outlineWidth > 0 && distance >= radius - outlineWidth && distance < radius + outlineWidth)
        return SLOT.outline;

      if (distance >= radius) {
        // Between diamonds: a small diamond centred on the shared corner.
        const fromCorner = diamondSize - distance;
        if (params.cornerJewel && fromCorner <= jewelSize + 1) return fromCorner <= 1 ? SLOT.primary : SLOT.accent;
        return SLOT.ground;
      }

      if (params.centre === 'jewels') {
        for (const [jewelX, jewelY] of jewelCentres) {
          const fromJewel = Math.abs(dx - jewelX) + Math.abs(dy - jewelY);
          if (fromJewel <= jewelSize) return jewelSize >= 2 && fromJewel <= 1 ? SLOT.outline : SLOT.accent;
        }
      } else if (params.centre === 'flower') {
        const flowerRadius = innerRadius * 0.65;
        const across = Math.min(Math.abs(dx), Math.abs(dy));
        const diagonalOffset = Math.abs(Math.abs(dx) - Math.abs(dy));
        if (distance <= 2) return SLOT.outline;
        if (across <= 1 && distance <= flowerRadius) return SLOT.accent; // four petals on the axes
        if (diagonalOffset <= 1 && distance <= flowerRadius * 0.75) return SLOT.accent; // four diagonal petals
      }

      // Bands, counted inwards from the outline: even bands get the secondary colour.
      const band = Math.floor((innerRadius - distance) / bandWidth);
      return band < bandCount * 2 && band % 2 === 0 ? SLOT.secondary : SLOT.primary;
    });
  },
});
