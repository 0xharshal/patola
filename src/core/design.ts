import { defaultParams, sanitizeParams, typedParams, type ParamSchema, type ParamValues, type Params } from './params';
import { randomSeed } from './rng';
import { DEFAULT_GENERATOR_ID, getGenerator } from '../generators/registry';
import { DEFAULT_LAYOUT_ID, getLayout } from '../layouts/registry';
import { BODY_ZONE, type Size, type ZoneDef, type ZoneFill } from '../layouts/types';
import { DEFAULT_PALETTE_ID, getPalette } from '../palettes/presets';

export type RenderMode = 'flat' | 'woven' | 'realistic';

export const RENDER_MODES: { value: RenderMode; label: string; help: string }[] = [
  { value: 'flat', label: 'Flat', help: 'The clean design grid, one colour per cell' },
  { value: 'woven', label: 'Woven', help: 'Warp and weft threads crossing over and under' },
  { value: 'realistic', label: 'Realistic', help: 'Woven, plus the soft ikat edges from dyed threads not lining up' },
];

/** Render knobs, described as a schema so the UI and URL handling are automatic. */
export const RENDER_SCHEMA = [
  {
    key: 'threadPx',
    type: 'float',
    label: 'Thread size',
    min: 1,
    max: 12,
    step: 0.5,
    default: 3,
    help: 'Width of one thread in pixels, in saved images and wallpapers',
  },
  {
    key: 'step',
    type: 'int',
    label: 'Threads per cell',
    min: 1,
    max: 8,
    default: 2,
    help: 'How many threads were tied together as one design cell',
  },
  {
    key: 'bleed',
    type: 'float',
    label: 'Ikat bleed',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,
    help: 'Dye seeping under the resist ties: wavy, feathered edges',
  },
  {
    key: 'warpJitter',
    type: 'float',
    label: 'Warp shift',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.15,
    help: 'How far each lengthwise (warp) thread is shifted from its intended place',
  },
  {
    key: 'weftJitter',
    type: 'float',
    label: 'Weft shift',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.15,
    help: 'How far each crosswise (weft) thread is shifted',
  },
  { key: 'sheen', type: 'float', label: 'Silk sheen', min: 0, max: 1, step: 0.01, default: 0.35 },
  {
    key: 'threads',
    type: 'select',
    label: 'Show threads',
    default: 'both',
    options: [
      { value: 'both', label: 'Both: the woven cloth' },
      { value: 'warp', label: 'Warp only (lengthwise)' },
      { value: 'weft', label: 'Weft only (crosswise)' },
    ],
    help: 'In double ikat both sets of threads are dyed before weaving. Look at one set alone to see its share of the pattern.',
  },
] as const satisfies ParamSchema;

export type RenderSettings = ParamValues<typeof RENDER_SCHEMA>;

/** Render settings with their precise types (they are always sanitised against RENDER_SCHEMA). */
export function renderSettings(render: Params): RenderSettings {
  return typedParams(RENDER_SCHEMA, render);
}

export const MIN_SIZE = 64;
/** Largest pixel size for wallpapers and saved images, for now; tiled export comes later. */
export const MAX_SIZE = 8192;

export interface Design extends ZoneFill {
  seed: number;
  /** `generator` and `params` (from ZoneFill) are the body zone's pattern. */
  layout: string;
  layoutSettings: Params;
  /** Patterns of the layout's other zones, by zone id. */
  zones: Record<string, ZoneFill>;
  /** Preset the colours came from; null once the user edits a colour. */
  paletteId: string | null;
  palette: string[];
  mode: RenderMode;
  render: Params;
  /** Pixel size for the "pattern only" layout; null = follow the screen. */
  size: Size | null;
}

export function defaultDesign(): Design {
  return {
    seed: randomSeed(),
    generator: DEFAULT_GENERATOR_ID,
    params: defaultParams(getGenerator(DEFAULT_GENERATOR_ID).params),
    layout: DEFAULT_LAYOUT_ID,
    layoutSettings: {},
    zones: {},
    paletteId: DEFAULT_PALETTE_ID,
    palette: [...getPalette(DEFAULT_PALETTE_ID)!.colors],
    mode: 'realistic',
    render: defaultParams(RENDER_SCHEMA),
    size: null,
  };
}

/** A zone fill from a default: the generator's defaults with the overrides applied. */
export function makeZoneFill(fill: ZoneDef['fill']): ZoneFill {
  const schema = getGenerator(fill.generator).params;
  return { generator: fill.generator, params: sanitizeParams(schema, { ...defaultParams(schema), ...fill.params }) };
}

function defaultZoneFill(design: Design, zoneId: string): ZoneFill {
  const zone = getLayout(design.layout).zones.find((candidate) => candidate.id === zoneId);
  return makeZoneFill(zone?.fill ?? { generator: DEFAULT_GENERATOR_ID });
}

/**
 * The pattern of a zone. The body's pattern is the design itself. applyLayout and
 * parseUrl create every zone of the layout, so the default is only a safety net.
 */
export function zoneFill(design: Design, zoneId: string): ZoneFill {
  if (zoneId === BODY_ZONE) return design;
  return design.zones[zoneId] ?? defaultZoneFill(design, zoneId);
}

/** Switch generator for a zone, resetting its parameters to that generator's defaults. */
export function setZoneGenerator(fill: ZoneFill, generatorId: string): void {
  fill.generator = generatorId;
  fill.params = defaultParams(getGenerator(generatorId).params);
}

/** Switch layout: default settings and zone patterns; the body keeps its pattern unless the layout has its own. */
export function applyLayout(design: Design, layoutId: string): void {
  const layout = getLayout(layoutId);
  design.layout = layout.id;
  design.layoutSettings = defaultParams(layout.settings);
  design.zones = Object.fromEntries(layout.zones.map((zone) => [zone.id, makeZoneFill(zone.fill)]));
  if (layout.body.fill) Object.assign(design, makeZoneFill(layout.body.fill));
}

export function clampSize(pixels: number): number {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(pixels)));
}

/** How many design cells fit in a pixel size at the current thread size. */
export function cellsForPixels(pixels: Size, render: Params): Size {
  const { threadPx, step } = renderSettings(render);
  const pixelsPerCell = threadPx * step;
  return {
    width: Math.max(1, Math.ceil(pixels.width / pixelsPerCell)),
    height: Math.max(1, Math.ceil(pixels.height / pixelsPerCell)),
  };
}
