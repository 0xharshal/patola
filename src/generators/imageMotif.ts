import { getMotif } from '../motifs/library';
import type { MotifGrid } from '../motifs/format';
import { MIRROR_ALTERNATE_PARAM, MOTIF_ARRANGEMENT_PARAM, MOTIF_GAP_PARAM } from './commonParams';
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
export function motifSlotAt(motif: MotifGrid, scale: number, mirrored: boolean, cellX: number, cellY: number): number {
  const scaledWidth = motif.width * scale;
  if (cellX < 0 || cellY < 0 || cellX >= scaledWidth || cellY >= motif.height * scale) return SLOT.ground;
  const pixelX = Math.floor((mirrored ? scaledWidth - 1 - cellX : cellX) / scale);
  return motif.slots[Math.floor(cellY / scale) * motif.width + pixelX];
}

/** How to repeat a motif over a zone (see MOTIF_GAP_PARAM, MOTIF_ARRANGEMENT_PARAM, MIRROR_ALTERNATE_PARAM). */
export interface MotifRepeat {
  gap: number;
  arrangement: string;
  mirror: boolean;
  /** Design cells per motif cell. */
  scale?: number;
  /** Map each motif slot (e.g. a colourway). */
  recolour?: (slot: number) => number;
}

/** Repeat `motif` over a zone of width × height cells. */
export function repeatMotif(motif: MotifGrid, repeat: MotifRepeat, width: number, height: number): Uint8Array {
  const scale = repeat.scale ?? 1;
  const motifWidth = motif.width * scale;
  const motifHeight = motif.height * scale;
  const single = repeat.arrangement === 'single';
  const tileWidth = single ? width : motifWidth + repeat.gap;
  const tileHeight = single ? height : motifHeight + repeat.gap;
  return fillGrid(width, height, (x, y) => {
    const { dx, dy, column } = tilePosition(x, y, tileWidth, tileHeight, repeat.arrangement === 'halfDrop');
    const mirrored = repeat.mirror && (column & 1) === 1;
    const slot = motifSlotAt(motif, scale, mirrored, Math.floor(dx + motifWidth / 2), Math.floor(dy + motifHeight / 2));
    return repeat.recolour ? repeat.recolour(slot) : slot;
  });
}

/**
 * Picture motif: repeats one motif (built-in, uploaded or drawn) on a grid,
 * like the figurative motifs of Nari Kunjar patola.
 */
export const imageMotif = defineGenerator({
  id: 'image',
  name: 'Picture motif',
  about:
    'Repeat one picture motif: a built-in elephant, parrot, dancer, vase, tree or symbol, or your own image or drawing. ' +
    'Motifs are made of the five palette colours, so they recolour with any palette and get the same ikat edges.',
  params: [
    { key: 'asset', type: 'asset', label: 'Motif', default: HATHI.id },
    { key: 'scale', type: 'int', label: 'Scale', min: 1, max: 8, default: 1, help: 'Design cells per motif cell' },
    MOTIF_GAP_PARAM,
    MOTIF_ARRANGEMENT_PARAM,
    MIRROR_ALTERNATE_PARAM,
  ],

  keepsHandedness: (params) => getMotif(params.asset)?.mirrorable === false,

  generate(params, { width, height }): Uint8Array {
    const motif = getMotif(params.asset);
    if (!motif) return missingMotifPattern(width, height);
    return repeatMotif(motif, { ...params, mirror: params.mirror && motif.mirrorable !== false }, width, height);
  },
});
