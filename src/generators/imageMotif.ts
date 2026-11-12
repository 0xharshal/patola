import { getMotif, type Motif } from '../motifs/library';
import { HATHI } from '../motifs/builtin';
import { fillGrid, positiveModulo, tilePosition } from './shapes';
import { SLOT, defineGenerator } from './types';

/** Shown when the chosen motif isn't in this browser: a sparse cross-hatch. */
export function missingMotifPattern(width: number, height: number): Uint8Array {
  return fillGrid(width, height, (x, y) =>
    positiveModulo(x - y, 10) === 0 || positiveModulo(x + y, 10) === 0 ? SLOT.outline : SLOT.ground,
  );
}

/** Palette slot of a motif cell, scaled up and optionally mirrored; ground outside the motif. */
export function motifSlotAt(motif: Motif, scale: number, mirrored: boolean, cellX: number, cellY: number): number {
  const scaledWidth = motif.width * scale;
  if (cellX < 0 || cellY < 0 || cellX >= scaledWidth || cellY >= motif.height * scale) return SLOT.ground;
  const pixelX = Math.floor((mirrored ? scaledWidth - 1 - cellX : cellX) / scale);
  return motif.slots[Math.floor(cellY / scale) * motif.width + pixelX];
}

/**
 * Picture motif: repeats one motif (built-in, uploaded or drawn) on a grid,
 * like the figurative motifs of Nari Kunjar patola.
 */
export const imageMotif = defineGenerator({
  id: 'image',
  name: 'Picture motif',
  about:
    'Repeat one picture motif: a built-in elephant, parrot, dancer, vase or tree, or your own image or drawing. ' +
    'Motifs are made of the five palette colours, so they recolour with any palette and get the same ikat edges.',
  params: [
    { key: 'asset', type: 'asset', label: 'Motif', default: HATHI.id },
    { key: 'scale', type: 'int', label: 'Scale', min: 1, max: 8, default: 1, help: 'Design cells per motif cell' },
    {
      key: 'gap',
      type: 'int',
      label: 'Spacing',
      min: 0,
      max: 60,
      default: 6,
      help: 'Ground between repeats, in cells',
    },
    {
      key: 'arrangement',
      type: 'select',
      label: 'Arrangement',
      default: 'halfDrop',
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'halfDrop', label: 'Half-drop' },
        { value: 'single', label: 'Single, centred' },
      ],
    },
    {
      key: 'mirror',
      type: 'bool',
      label: 'Mirror alternate',
      default: true,
      help: 'Every other column faces the other way',
    },
  ],

  generate(params, { width, height }): Uint8Array {
    const motif = getMotif(params.asset);
    if (!motif) return missingMotifPattern(width, height);
    const scale = params.scale;
    const motifWidth = motif.width * scale;
    const motifHeight = motif.height * scale;
    const single = params.arrangement === 'single';
    const tileWidth = single ? width : motifWidth + params.gap;
    const tileHeight = single ? height : motifHeight + params.gap;

    return fillGrid(width, height, (x, y) => {
      const { dx, dy, column } = tilePosition(x, y, tileWidth, tileHeight, params.arrangement === 'halfDrop');
      const mirrored = Boolean(params.mirror) && (column & 1) === 1;
      return motifSlotAt(motif, scale, mirrored, Math.floor(dx + motifWidth / 2), Math.floor(dy + motifHeight / 2));
    });
  },
});
