import type { BoolParam } from '../core/params';
import { getMotif } from '../motifs/library';
import { HANSA, HATHI, KALASH, MOR, NARI, POPAT, VRIKSHA, type BuiltInMotif } from '../motifs/builtin';
import { motifSlotAt } from './imageMotif';
import { MIRROR_ALTERNATE_PARAM } from './commonParams';
import { fillGrid, positiveModulo } from './shapes';
import { SLOT, defineGenerator } from './types';

/** Which built-in motifs take part, as toggles. */
const MOTIF_TOGGLES = [
  { motif: HATHI, param: { key: 'elephant', type: 'bool', label: 'Elephants', default: true } },
  { motif: NARI, param: { key: 'dancer', type: 'bool', label: 'Dancers', default: true } },
  { motif: POPAT, param: { key: 'parrot', type: 'bool', label: 'Parrots', default: true } },
  { motif: KALASH, param: { key: 'vase', type: 'bool', label: 'Flower vases', default: true } },
  { motif: VRIKSHA, param: { key: 'tree', type: 'bool', label: 'Trees', default: false } },
  { motif: MOR, param: { key: 'peacock', type: 'bool', label: 'Peacocks', default: false } },
  { motif: HANSA, param: { key: 'swan', type: 'bool', label: 'Swans', default: false } },
] as const satisfies readonly { motif: BuiltInMotif; param: BoolParam }[];

const LATTICE_WIDTH: Record<string, number> = { none: 0, single: 1, double: 3 };

/**
 * Nari Kunjar ("women and elephants"): squares in a lattice, each holding one
 * figurative motif, cycling through elephants, dancers, parrots and flowers.
 */
export const nariKunjar = defineGenerator({
  id: 'nari-kunjar',
  name: 'Nari Kunjar (women & elephants)',
  about:
    'The famous figurative patola design: rows of dancing women, elephants, parrots and flowers, each in its own square. ' +
    'Figures this detailed take weavers months to tie.',
  params: [
    ...MOTIF_TOGGLES.map((toggle) => toggle.param),
    {
      key: 'arrangement',
      type: 'select',
      label: 'Arrangement',
      default: 'rows',
      options: [
        { value: 'rows', label: 'One motif per row' },
        { value: 'diagonal', label: 'Diagonal' },
      ],
    },
    {
      key: 'lattice',
      type: 'select',
      label: 'Lattice',
      default: 'double',
      options: [
        { value: 'none', label: 'None' },
        { value: 'single', label: 'Single line' },
        { value: 'double', label: 'Double line' },
      ],
    },
    {
      key: 'padding',
      type: 'int',
      label: 'Padding',
      min: 0,
      max: 16,
      default: 4,
      help: 'Ground around each motif, in cells',
    },
    MIRROR_ALTERNATE_PARAM,
  ],

  generate(params, { width, height }): Uint8Array {
    const chosen = MOTIF_TOGGLES.filter((toggle) => params[toggle.param.key]).map((toggle) =>
      getMotif(toggle.motif.id)!,
    );
    const motifs = chosen.length > 0 ? chosen : [getMotif(HATHI.id)!];
    const latticeWidth = LATTICE_WIDTH[params.lattice] ?? 0;
    const padding = params.padding;
    const innerSize = Math.max(...motifs.flatMap((motif) => [motif.width, motif.height])) + 2 * padding;
    const cellSize = innerSize + latticeWidth;

    return fillGrid(width, height, (x, y) => {
      const column = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      const insideX = positiveModulo(x, cellSize) - latticeWidth;
      const insideY = positiveModulo(y, cellSize) - latticeWidth;

      if (insideX < 0 || insideY < 0) {
        // Lattice: a double line is outline – secondary – outline, with accent jewels where lines cross.
        const depth = Math.min(insideX, insideY) + latticeWidth;
        if (insideX < 0 && insideY < 0) return SLOT.accent;
        return latticeWidth === 3 && depth === 1 ? SLOT.secondary : SLOT.outline;
      }

      const motif = motifs[(params.arrangement === 'diagonal' ? column + row : row) % motifs.length];
      const offsetX = Math.floor((innerSize - motif.width) / 2);
      const offsetY = Math.floor((innerSize - motif.height) / 2);
      const mirrored = Boolean(params.mirror) && (column & 1) === 1;
      return motifSlotAt(motif, 1, mirrored, insideX - offsetX, insideY - offsetY);
    });
  },
});
