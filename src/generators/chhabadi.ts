import { outlineParam } from './commonParams';
import { fillGrid, positiveModulo } from './shapes';
import { SLOT, defineGenerator } from './types';

/**
 * Chhabadi (basket): two sets of diagonal bands that pass over and under each
 * other, like a woven basket, with a jewel in each opening.
 */
export const chhabadi = defineGenerator({
  id: 'chhabadi',
  name: 'Chhabadi (basket lattice)',
  about:
    'Diagonal bands crossing over and under each other like a woven basket. ' +
    'Each crossing is drawn only with the top band, giving the illusion of interlacing.',
  params: [
    { key: 'spacing', type: 'int', label: 'Spacing', min: 6, max: 48, default: 18, random: [10, 30] },
    { key: 'band', type: 'int', label: 'Band width', min: 2, max: 16, default: 6, random: [3, 9] },
    {
      key: 'interlace',
      type: 'bool',
      label: 'Over-under',
      default: true,
      help: 'Alternate which band is on top at each crossing',
    },
    outlineParam(true, 'Band edges'),
    {
      key: 'dot',
      type: 'int',
      label: 'Jewel size',
      min: 0,
      max: 8,
      default: 2,
      help: 'Jewel inside each opening (0 = none)',
    },
  ],

  generate(params, { width, height }): Uint8Array {
    const spacing = params.spacing;
    const bandWidth = Math.min(params.band, spacing - 2);
    const jewelSize = params.dot;
    const openingCentre = bandWidth + (spacing - bandWidth - 1) / 2;

    return fillGrid(width, height, (x, y) => {
      // Rotated coordinates: one set of bands runs along constant x+y, the other along constant x−y.
      const downDiagonal = x + y;
      const upDiagonal = x - y;
      const acrossDownBand = positiveModulo(downDiagonal, spacing);
      const acrossUpBand = positiveModulo(upDiagonal, spacing);
      const inDownBand = acrossDownBand < bandWidth;
      const inUpBand = acrossUpBand < bandWidth;

      if (inDownBand || inUpBand) {
        let downBandOnTop = inDownBand;
        if (inDownBand && inUpBand) {
          const crossingParity = (Math.floor(downDiagonal / spacing) + Math.floor(upDiagonal / spacing)) & 1;
          downBandOnTop = !params.interlace || crossingParity === 0;
        }
        const acrossTopBand = downBandOnTop ? acrossDownBand : acrossUpBand;
        if (params.outline && (acrossTopBand === 0 || acrossTopBand === bandWidth - 1)) return SLOT.outline;
        return downBandOnTop ? SLOT.primary : SLOT.secondary;
      }

      // Opening between bands: a square in rotated space is a diamond on screen.
      const fromOpeningCentre = Math.max(
        Math.abs(acrossDownBand - openingCentre),
        Math.abs(acrossUpBand - openingCentre),
      );
      return jewelSize > 0 && fromOpeningCentre <= jewelSize ? SLOT.accent : SLOT.ground;
    });
  },
});
