import { getSymbol, SYMBOLS, symbolGrid } from '../motifs/symbols';
import {
  COLOURWAY_PARAM,
  colourwaySlot,
  MIRROR_ALTERNATE_PARAM,
  MOTIF_ARRANGEMENT_PARAM,
  MOTIF_GAP_PARAM,
  outlineParam,
} from './commonParams';
import { repeatMotif } from './imageMotif';
import { defineGenerator } from './types';

/** Symbols drawn as shapes (see motifs/symbols.ts), at any size, repeated over the zone. */
export const symbols = defineGenerator({
  id: 'symbols',
  name: 'Symbols',
  about:
    'Auspicious symbols and folk figures of Gujarat: diya, saathiya, peacock, mango, kite, dandiya, Om, trishul, ' +
    'bow and arrow, swan, charkha and wheels. They are drawn from shapes, so they stay crisp at any size; ' +
    'on the thread grid their curves become small steps.',
  params: [
    {
      key: 'symbol',
      type: 'select',
      label: 'Symbol',
      default: 'diya',
      options: SYMBOLS.map((symbol) => ({ value: symbol.id, label: symbol.name })),
    },
    {
      key: 'size',
      type: 'int',
      label: 'Size',
      min: 10,
      max: 80,
      default: 28,
      random: [16, 44],
      help: 'Height of each symbol, in design cells',
    },
    MOTIF_GAP_PARAM,
    MOTIF_ARRANGEMENT_PARAM,
    MIRROR_ALTERNATE_PARAM,
    COLOURWAY_PARAM,
    outlineParam(true),
  ],

  // Only figures facing a direction may be mirrored; a mirrored saathiya or Om would change its meaning.
  keepsHandedness: (params) => getSymbol(params.symbol).faces !== true,

  generate(params, { width, height }): Uint8Array {
    const symbol = getSymbol(params.symbol);
    const grid = symbolGrid(symbol, params.size, params.outline);
    const mirror = params.mirror && symbol.faces === true;
    return repeatMotif(
      grid,
      { ...params, mirror, recolour: (slot) => colourwaySlot(slot, params.colourway) },
      width,
      height,
    );
  },
});
