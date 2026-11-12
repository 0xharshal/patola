import { fillGrid, positiveModulo } from './shapes';
import { SLOT, defineGenerator } from './types';

/**
 * Chowkdi (checks): squares separated by lines, optionally two-toned like a
 * chessboard, with a stepped dot in each square and a jewel at every crossing.
 */
export const chowkdi = defineGenerator({
  id: 'chowkdi',
  name: 'Chowkdi (checks)',
  about:
    'A simple grid of squares. Checks are among the easiest ikat patterns to tie, ' +
    'and often fill borders or the plain body of a patola.',
  params: [
    { key: 'size', type: 'int', label: 'Square size', min: 4, max: 60, default: 14, random: [8, 30] },
    { key: 'line', type: 'int', label: 'Line width', min: 0, max: 6, default: 2 },
    {
      key: 'twoTone',
      type: 'bool',
      label: 'Two-tone',
      default: true,
      help: 'Alternate square colours like a chessboard',
    },
    {
      key: 'dot',
      type: 'int',
      label: 'Dot size',
      min: 0,
      max: 10,
      default: 3,
      help: 'Stepped diamond in each square (0 = none)',
    },
  ],

  generate(params, { width, height }): Uint8Array {
    const squareSize = params.size;
    const lineWidth = Math.min(params.line, squareSize - 1);
    const dotSize = params.dot;
    const squareCentre = (squareSize + lineWidth) / 2;

    return fillGrid(width, height, (x, y) => {
      const inSquareX = positiveModulo(x, squareSize);
      const inSquareY = positiveModulo(y, squareSize);
      const onVerticalLine = inSquareX < lineWidth;
      const onHorizontalLine = inSquareY < lineWidth;

      if (onVerticalLine && onHorizontalLine) return SLOT.outline;
      if (onVerticalLine || onHorizontalLine) return SLOT.ground;

      const fromCentre = Math.abs(inSquareX + 0.5 - squareCentre) + Math.abs(inSquareY + 0.5 - squareCentre);
      if (dotSize > 0 && fromCentre <= dotSize) return SLOT.accent;
      const isAlternate = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 !== 0;
      return params.twoTone && isAlternate ? SLOT.secondary : SLOT.primary;
    });
  },
});
