import { fillGrid, positiveModulo, triangleWave } from './shapes';
import { SLOT, defineGenerator } from './types';

/**
 * Kinar (border band): guard lines along both edges, optional triangular teeth,
 * and a chain of motifs running along the band. The band follows the longer
 * side of its zone, so the same pattern works for horizontal and vertical borders.
 */
export const kinar = defineGenerator({
  id: 'kinar',
  name: 'Kinar (border band)',
  about:
    'A border strip: guard lines, rows of triangular teeth and a running chain of motifs. ' +
    'Made for narrow zones; it always runs along the longer side.',
  params: [
    {
      key: 'motif',
      type: 'select',
      label: 'Motif',
      default: 'diamonds',
      options: [
        { value: 'diamonds', label: 'Diamond chain' },
        { value: 'flowers', label: 'Small flowers' },
        { value: 'zigzag', label: 'Zigzag' },
        { value: 'checks', label: 'Checks' },
      ],
    },
    {
      key: 'spacing',
      type: 'float',
      label: 'Motif spacing',
      min: 0.5,
      max: 3,
      step: 0.05,
      default: 1,
      help: 'Distance between motifs, relative to the band width',
    },
    { key: 'guard', type: 'int', label: 'Guard lines', min: 0, max: 4, default: 1 },
    { key: 'teeth', type: 'bool', label: 'Teeth', default: true, help: 'Triangles along both inner edges' },
  ],

  generate(params, { width, height }): Uint8Array {
    const runsHorizontally = width >= height;
    const bandWidth = runsHorizontally ? height : width;
    const guardWidth = Math.min(params.guard, Math.floor(bandWidth / 4));
    const innerWidth = bandWidth - 2 * guardWidth;
    const toothSize = params.teeth ? Math.max(2, Math.floor(innerWidth * 0.2)) : 0;
    const motifRadius = innerWidth / 2 - toothSize - 1;
    const motifSpacing = Math.max(4, Math.round(innerWidth * params.spacing));

    return fillGrid(width, height, (x, y) => {
      const along = runsHorizontally ? x : y;
      const across = runsHorizontally ? y : x;
      if (across < guardWidth || across >= bandWidth - guardWidth) return SLOT.outline;
      const inner = across - guardWidth;

      // Teeth: triangles pointing inwards from both edges.
      if (toothSize > 0) {
        const fromEdge = Math.min(inner, innerWidth - 1 - inner);
        const toothHeight = toothSize - Math.abs(positiveModulo(along, 2 * toothSize) - toothSize);
        if (fromEdge < toothHeight) return SLOT.secondary;
      }

      const dAlong = Math.abs(positiveModulo(along, motifSpacing) + 0.5 - motifSpacing / 2);
      const dAcross = Math.abs(inner + 0.5 - innerWidth / 2);
      switch (params.motif) {
        case 'diamonds': {
          const distance = dAlong + dAcross;
          if (distance > motifRadius) return SLOT.ground;
          if (distance > motifRadius - 1) return SLOT.outline;
          return distance <= motifRadius * 0.4 ? SLOT.accent : SLOT.primary;
        }
        case 'flowers': {
          const distance = dAlong + dAcross;
          if (distance <= 1) return SLOT.accent;
          const onPetalAxis = Math.min(dAlong, dAcross) <= Math.max(1, motifRadius * 0.3);
          return onPetalAxis && Math.max(dAlong, dAcross) <= motifRadius ? SLOT.primary : SLOT.ground;
        }
        case 'zigzag': {
          const zigzagHeight = Math.max(1, innerWidth - 2 * toothSize - 3);
          const line = toothSize + 1 + triangleWave(along, motifSpacing, zigzagHeight);
          return Math.abs(inner - line) <= Math.max(1, innerWidth * 0.08) ? SLOT.primary : SLOT.ground;
        }
        default: {
          const checkSize = Math.max(2, Math.floor(innerWidth / 2));
          return (Math.floor(along / checkSize) + Math.floor(inner / checkSize)) % 2 === 0 ? SLOT.primary : SLOT.accent;
        }
      }
    });
  },
});
