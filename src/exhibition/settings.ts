/** Exhibition (slideshow) settings and the designs it shows one after another. */
import { applyLayout, type Design } from '../core/design';
import { typedParams, type ParamSchema, type ParamValues, type Params } from '../core/params';
import { MAX_SEED, type Rng } from '../core/rng';
import { randomizeColours, randomizePattern, surprise } from '../core/randomize';
import { LAYOUTS } from '../layouts/registry';

export const EXHIBITION_SCHEMA = [
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

/** The design after `design`: a copy, changed as the settings say. Same `random`, same design. */
export function nextDesign(design: Design, vary: ExhibitionSettings['vary'], random: Rng): Design {
  const next: Design = JSON.parse(JSON.stringify(design));
  if (vary === 'none') return next;
  if (vary === 'colours') {
    randomizeColours(next, [], random);
  } else if (vary === 'pattern') {
    randomizePattern(next, random);
    for (const fill of Object.values(next.zones)) randomizePattern(fill, random);
  } else {
    applyLayout(next, LAYOUTS[Math.floor(random() * LAYOUTS.length)].id);
    surprise(next, [], random);
  }
  next.seed = Math.floor(random() * (MAX_SEED + 1));
  return next;
}
