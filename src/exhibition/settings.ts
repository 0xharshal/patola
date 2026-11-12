/** Exhibition (slideshow) settings and the designs it shows one after another. */
import { applyLayout, type Design } from '../core/design';
import { typedParams, type ParamSchema, type ParamValues, type Params } from '../core/params';
import { MAX_SEED, type Rng } from '../core/rng';
import { randomizeColours, randomizePattern, surprise } from '../core/randomize';
import { LAYOUTS } from '../layouts/registry';
import type { LayoutDef } from '../layouts/types';

export const EXHIBITION_SCHEMA = [
  {
    key: 'style',
    type: 'select',
    label: 'Style',
    default: 'fabric',
    options: [
      { value: 'gallery', label: 'One design at a time' },
      { value: 'fabric', label: 'Endless fabric' },
    ],
    help: 'One design at a time: the camera tours each design, then the next fades in. Endless fabric: many designs side by side glide past, now one way, now another.',
  },
  {
    key: 'speed',
    type: 'float',
    label: 'Fabric speed',
    min: 0.01,
    max: 0.12,
    step: 0.01,
    default: 0.05,
    help: 'How fast the endless fabric glides, in screen heights per second.',
  },
  {
    key: 'hold',
    type: 'int',
    label: 'Each design fills the screen for',
    min: 1,
    max: 20,
    default: 5,
    help: 'Seconds, at least, that each design of the endless fabric fills the whole screen as it glides past. Longer times use larger (more memory-hungry) panels; at fast speeds the time is limited to what one extra screen of cloth allows.',
  },
  {
    key: 'vary',
    type: 'select',
    label: 'Next design',
    default: 'all',
    options: [
      { value: 'all', label: 'Anything new, layouts too' },
      { value: 'pattern', label: 'New patterns, same layout' },
      { value: 'colours', label: 'New colours' },
      { value: 'none', label: 'Keep this design' },
    ],
    help: 'What changes from one design to the next. "Keep this design" only moves the camera.',
  },
  {
    key: 'seconds',
    type: 'int',
    label: 'Seconds per design',
    min: 15,
    max: 600,
    step: 5,
    default: 60,
  },
  {
    key: 'closeups',
    type: 'bool',
    label: 'Close-ups of the threads',
    default: true,
    help: 'Zoom in until single threads, the feathered ikat edges and the silk show',
  },
  { key: 'captions', type: 'bool', label: 'Captions', default: true, help: 'Name and story of each design' },
] as const satisfies ParamSchema;

export type ExhibitionSettings = ParamValues<typeof EXHIBITION_SCHEMA>;

export function exhibitionSettings(values: Params): ExhibitionSettings {
  return typedParams(EXHIBITION_SCHEMA, values);
}

/**
 * The design after `design`: a copy, changed as the settings say. Same `random`,
 * same design. "Anything new" picks one of `layouts`.
 */
export function nextDesign(
  design: Design,
  vary: ExhibitionSettings['vary'],
  random: Rng,
  layouts: readonly LayoutDef[] = LAYOUTS,
): Design {
  const next: Design = JSON.parse(JSON.stringify(design));
  if (vary === 'none') return next;
  if (vary === 'colours') {
    randomizeColours(next, [], random);
  } else if (vary === 'pattern') {
    randomizePattern(next, random);
    for (const fill of Object.values(next.zones)) randomizePattern(fill, random);
  } else {
    applyLayout(next, layouts[Math.floor(random() * layouts.length)].id);
    surprise(next, [], random);
  }
  next.seed = Math.floor(random() * (MAX_SEED + 1));
  return next;
}
