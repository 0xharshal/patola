import { ZARI_SLOT } from '../generators/types';
import { frameRegions, insetRect } from './regions';
import { BODY_ZONE, defineLayout, ONE_MOTIF_SETTING, type Region } from './types';

/**
 * Gharchola-style grid: gold (zari) lines divide the cloth into squares, each
 * filled with a patola motif, inside a border frame.
 */
export const gharchola = defineLayout({
  id: 'gharchola',
  name: 'Gharchola grid',
  about:
    'Inspired by the Gujarati wedding gharchola: gold zari lines divide the cloth into squares, ' +
    'each holding a motif. Here the squares are filled with patola designs.',
  settings: [
    { key: 'along', type: 'int', label: 'Squares along', min: 2, max: 60, default: 18 },
    { key: 'across', type: 'int', label: 'Squares across', min: 2, max: 30, default: 7 },
    {
      key: 'cell',
      type: 'int',
      label: 'Square size',
      min: 8,
      max: 60,
      default: 24,
      help: 'Inside of each square, in design cells',
    },
    { key: 'line', type: 'int', label: 'Zari line width', min: 1, max: 6, default: 2 },
    {
      key: 'arrangement',
      type: 'select',
      label: 'Arrangement',
      default: 'checker',
      options: [
        { value: 'checker', label: 'Chequered A / B' },
        { value: 'rows', label: 'Alternating rows' },
        { value: 'single', label: 'All squares A' },
      ],
    },
    ONE_MOTIF_SETTING,
    { key: 'border', type: 'int', label: 'Border width', min: 0, max: 60, default: 18 },
  ],
  body: {
    name: 'Squares A',
    about: 'The motif in the first set of squares.',
    oneMotif: true,
    fill: { generator: 'phool', params: { repeat: 24, halfDrop: false, leaves: 0 } },
  },
  zones: [
    {
      id: 'cellB',
      name: 'Squares B',
      about: 'The motif in the alternate squares.',
      oneMotif: true,
      fill: { generator: 'navratna', params: { repeat: 24, rings: 0, cornerJewel: false } },
    },
    {
      id: 'border',
      name: 'Border',
      about: 'The frame around the grid.',
      fill: { generator: 'kinar', params: { motif: 'diamonds' } },
    },
  ],
  warpHorizontal: true,

  size(settings) {
    const pitch = settings.cell + settings.line;
    const extra = settings.line + 2 * settings.border;
    return {
      width: settings.along * pitch + extra,
      height: settings.across * pitch + extra,
    };
  },

  regions(settings, size) {
    const borderWidth = settings.border;
    const cellSize = settings.cell;
    const lineWidth = settings.line;
    const pitch = cellSize + lineWidth;
    const grid = insetRect({ x: 0, y: 0, ...size }, borderWidth);

    const regions: Region[] = [
      ...frameRegions('border', { x: 0, y: 0, ...size }, borderWidth),
      // Zari fills the whole grid area; the squares are painted on top, leaving the lines.
      { fillSlot: ZARI_SLOT, ...grid },
    ];
    for (let column = 0; column < settings.along; column++) {
      for (let row = 0; row < settings.across; row++) {
        const isB =
          settings.arrangement === 'checker'
            ? (column + row) % 2 === 1
            : settings.arrangement === 'rows' && row % 2 === 1;
        regions.push({
          zone: isB ? 'cellB' : BODY_ZONE,
          x: grid.x + lineWidth + column * pitch,
          y: grid.y + lineWidth + row * pitch,
          width: cellSize,
          height: cellSize,
        });
      }
    }
    return regions;
  },
});
