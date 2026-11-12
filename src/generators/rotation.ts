/**
 * Rotation for every pattern. A turned pattern is still tied on the thread grid,
 * so it is not drawn at an angle: each cell takes the pattern cell it lands on
 * when turned back. At 45° a square grid becomes a diagonal grid with the
 * stepped, staircase edges of ikat.
 */
import type { NumberParam } from '../core/params';
import { fillGrid } from './shapes';
import type { Generator } from './types';

export const ROTATION_PARAM = {
  key: 'rotation',
  type: 'int',
  label: 'Rotation',
  min: 0,
  max: 180,
  step: 5,
  default: 0,
  random: [0, 0], // shuffles keep patterns upright; turning is a deliberate choice
  help: 'Turn the whole pattern, in degrees. At 45° a square grid becomes a diagonal grid.',
} as const satisfies NumberParam<'rotation'>;

/** The same generator with a Rotation setting, turning the pattern around the zone centre. */
export function withRotation(generator: Generator): Generator {
  return {
    ...generator,
    params: [...generator.params, ROTATION_PARAM],
    generate(params, context) {
      const degrees = Number(params[ROTATION_PARAM.key] ?? 0);
      if (!degrees) return generator.generate(params, context);

      // Exact values at right angles: cos 90° is 6e-17 in floating point, which would
      // tip cells that sit exactly on a cell border into the neighbouring cell.
      const exact = (value: number) => Math.round(value * 1e9) / 1e9;
      const angle = (degrees * Math.PI) / 180;
      const cos = exact(Math.cos(angle));
      const sin = exact(Math.sin(angle));
      const { width, height } = context;
      // The unrotated pattern must cover the zone after turning: its bounding box, plus a margin.
      const sourceWidth = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin)) + 2;
      const sourceHeight = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos)) + 2;
      const source = generator.generate(params, { ...context, width: sourceWidth, height: sourceHeight });
      const clamp = (value: number, size: number) => Math.min(size - 1, Math.max(0, value));

      return fillGrid(width, height, (x, y) => {
        // Cell centre relative to the zone centre, turned back by the rotation angle.
        const dx = x + 0.5 - width / 2;
        const dy = y + 0.5 - height / 2;
        const sourceX = clamp(Math.floor(cos * dx + sin * dy + sourceWidth / 2), sourceWidth);
        const sourceY = clamp(Math.floor(-sin * dx + cos * dy + sourceHeight / 2), sourceHeight);
        return source[sourceY * sourceWidth + sourceX];
      });
    },
  };
}
