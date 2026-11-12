import { drawWheel } from '../motifs/symbols';
import { MotifSketch } from '../motifs/sketch';
import { COLOURWAY_PARAM, colourwaySlot, MOTIF_ARRANGEMENT_PARAM, MOTIF_GAP_PARAM, outlineParam } from './commonParams';
import { repeatMotif } from './imageMotif';
import { defineGenerator } from './types';

/** Wheels from spokes, rings, rim loops and a hub: Ashoka chakra, charkha wheels, concentric circles. */
export const chakra = defineGenerator({
  id: 'chakra',
  name: 'Chakra (wheels and circles)',
  about:
    'Wheels repeated over the cloth. 24 spokes with loops on the rim give the Ashoka chakra, the wheel of dharma; ' +
    'no spokes and several rings give concentric circles. The wheel is also the charkha that spins the yarn.',
  params: [
    {
      key: 'size',
      type: 'int',
      label: 'Size',
      min: 10,
      max: 80,
      default: 32,
      random: [18, 48],
      help: 'Diameter of each wheel, in design cells',
    },
    {
      key: 'spokes',
      type: 'int',
      label: 'Spokes',
      min: 0,
      max: 32,
      default: 24,
      random: [0, 24],
      help: 'Use fewer spokes for small wheels; 0 for concentric circles',
    },
    {
      key: 'rings',
      type: 'int',
      label: 'Rings',
      min: 0,
      max: 8,
      default: 0,
      random: [0, 5],
      help: 'Coloured rings inside the rim',
    },
    {
      key: 'rimLoops',
      type: 'bool',
      label: 'Rim loops',
      default: true,
      help: 'Small loops on the rim between the spokes, as on the Ashoka chakra',
    },
    {
      key: 'hub',
      type: 'float',
      label: 'Hub size',
      min: 0,
      max: 0.6,
      step: 0.02,
      default: 0.2,
      help: 'Share of the wheel',
    },
    MOTIF_GAP_PARAM,
    MOTIF_ARRANGEMENT_PARAM,
    COLOURWAY_PARAM,
    outlineParam(true),
  ],

  generate(params, { width, height }): Uint8Array {
    const sketch = new MotifSketch(32, 32, params.size / 32);
    drawWheel(sketch, params);
    if (params.outline) sketch.outline();
    return repeatMotif(
      sketch.grid(),
      { ...params, mirror: false, recolour: (slot) => colourwaySlot(slot, params.colourway) },
      width,
      height,
    );
  },
});
