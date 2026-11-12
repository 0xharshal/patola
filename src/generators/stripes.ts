import { COLOUR_COUNT_PARAM, outlineParam } from './commonParams';
import { bandSequence, fillGrid, positiveModulo, triangleWave } from './shapes';
import { SLOT, defineGenerator } from './types';

/** Stepped diagonal stripes and zigzags, cycling through 2–5 colours. */
export const stripes = defineGenerator({
  id: 'stripes',
  name: 'Stripes & zigzags',
  about:
    'Diagonal stripes and zigzags. On a thread grid every diagonal becomes a staircase; ' +
    'the steps are a direct trace of how the threads were tied.',
  params: [
    {
      key: 'style',
      type: 'select',
      label: 'Style',
      default: 'zigzag-h',
      options: [
        { value: 'diagonal', label: 'Diagonal' },
        { value: 'zigzag-h', label: 'Zigzag (horizontal)' },
        { value: 'zigzag-v', label: 'Zigzag (vertical)' },
      ],
    },
    { key: 'band', type: 'int', label: 'Stripe width', min: 1, max: 24, default: 4, random: [2, 8] },
    COLOUR_COUNT_PARAM,
    { key: 'period', type: 'int', label: 'Zigzag width', min: 4, max: 80, default: 24, random: [10, 40] },
    { key: 'amplitude', type: 'int', label: 'Zigzag height', min: 1, max: 40, default: 10, random: [4, 20] },
    outlineParam(false, 'Dividing lines'),
  ],

  generate(params, { width, height }): Uint8Array {
    const stripeWidth = params.band;
    const slots = bandSequence(params.colours);
    const period = params.period;
    const amplitude = params.amplitude;

    return fillGrid(width, height, (x, y) => {
      const position =
        params.style === 'diagonal'
          ? x + y
          : params.style === 'zigzag-h'
            ? y + triangleWave(x, period, amplitude)
            : x + triangleWave(y, period, amplitude);
      if (params.outline && stripeWidth > 1 && positiveModulo(position, stripeWidth) === 0) return SLOT.outline;
      return slots[positiveModulo(Math.floor(position / stripeWidth), slots.length)];
    });
  },
});
