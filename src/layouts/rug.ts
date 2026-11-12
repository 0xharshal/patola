import { SLOT } from '../generators/types';
import { frameRegions, insetRect, outlineRegions } from './regions';
import { BODY_ZONE, defineLayout } from './types';

/** A field inside a border frame with corner squares and an inner guard band. */
export const rug = defineLayout({
  id: 'rug',
  name: 'Rug / frame',
  about: 'A plain rectangle: a central field framed by a border with corner squares and a narrow inner guard band.',
  settings: [
    { key: 'length', type: 'int', label: 'Length', min: 60, max: 600, default: 240, help: 'Length in design cells' },
    {
      key: 'proportion',
      type: 'float',
      label: 'Proportion',
      min: 0.3,
      max: 1,
      step: 0.01,
      default: 0.66,
      help: 'Width as a share of the length',
    },
    {
      key: 'border',
      type: 'float',
      label: 'Border width',
      min: 0.05,
      max: 0.3,
      step: 0.01,
      default: 0.14,
      help: 'Share of the shorter side',
    },
    { key: 'guard', type: 'int', label: 'Guard band', min: 0, max: 24, default: 6 },
    { key: 'divider', type: 'int', label: 'Dividing lines', min: 0, max: 3, default: 1 },
  ],
  body: { name: 'Field', about: 'The central field.' },
  zones: [
    {
      id: 'border',
      name: 'Border',
      about: 'The main frame around the field.',
      fill: { generator: 'kinar', params: { motif: 'flowers' } },
    },
    {
      id: 'guard',
      name: 'Guard band',
      about: 'A narrow inner frame between border and field.',
      fill: { generator: 'kinar', params: { motif: 'checks', teeth: false, guard: 0 } },
    },
    {
      id: 'corner',
      name: 'Corners',
      about: 'Squares where the borders meet.',
      fill: { generator: 'diamonds', params: { repeat: 32, ring: 2 } },
    },
  ],
  warpHorizontal: true,
  size: (settings) => {
    const length = settings.length;
    return { width: length, height: Math.round(length * settings.proportion) };
  },

  regions(settings, size) {
    const borderWidth = Math.round(settings.border * Math.min(size.width, size.height));
    const guardWidth = settings.guard;
    const lineWidth = settings.divider;
    const whole = { x: 0, y: 0, ...size };
    const insideBorder = insetRect(whole, borderWidth);
    const field = insetRect(insideBorder, guardWidth);

    return [
      ...frameRegions('border', whole, borderWidth, 'corner'),
      ...frameRegions('guard', insideBorder, guardWidth),
      { zone: BODY_ZONE, ...field },
      // Lines around the outside, between border and guard, and around the field.
      ...outlineRegions(whole, lineWidth, SLOT.outline),
      ...outlineRegions(insetRect(insideBorder, -Math.floor(lineWidth / 2)), lineWidth, SLOT.outline),
      ...(guardWidth > 0 ? outlineRegions(insetRect(field, -Math.floor(lineWidth / 2)), lineWidth, SLOT.outline) : []),
    ];
  },
});
