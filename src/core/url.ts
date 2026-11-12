/**
 * Readable URL parameters <-> Design. The parameter reference for users lives
 * in README.md ("URL parameters"); keep the two in sync.
 *
 * Invalid or unknown values are ignored, never fatal.
 */
import { applyLayout, clampSize, defaultDesign, RENDER_SCHEMA, zoneFill, type Design, type RenderMode } from './design';
import { MAX_SEED, randomSeed } from './rng';
import { formatValue, sanitizeParams, sanitizeValue, type ParamSchema, type Params } from './params';
import { findGenerator, getGenerator } from '../generators/registry';
import { findLayout, getLayout } from '../layouts/registry';
import type { ZoneFill } from '../layouts/types';
import { getPalette, parseHexList } from '../palettes/presets';
import { randomizeColours, randomizePattern, surprise } from './randomize';
import { MAX_EXPORT_SIDE } from '../export/sizes';
import { EXHIBITION_SCHEMA } from '../exhibition/settings';

export const URL_VERSION = 1;

export type View = 'editor' | 'wallpaper' | 'exhibition';
const VIEWS: View[] = ['editor', 'wallpaper', 'exhibition'];

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'design';
export const EXPORT_FORMATS: ExportFormat[] = ['png', 'jpg', 'svg', 'design'];

/** `download=<format>&size=<long side px>`: export as soon as the page has loaded. */
export interface DownloadRequest {
  format: ExportFormat;
  /** Long side in pixels; null = at thread size. */
  longSide: number | null;
}

export interface UrlState {
  design: Design;
  view: View;
  download: DownloadRequest | null;
  /** Exhibition settings (see EXHIBITION_SCHEMA), also read when the page opens in the editor. */
  exhibition: Params;
}

/** `random=pattern,colours,seed` or `random=all`: what to re-roll on every load. */
const RANDOM_ASPECTS = ['pattern', 'colours', 'seed', 'all'] as const;

function applyRandom(design: Design, aspects: string[]): void {
  if (aspects.includes('all')) return surprise(design);
  if (aspects.includes('pattern')) {
    randomizePattern(design);
    for (const fill of Object.values(design.zones)) randomizePattern(fill);
  }
  if (aspects.includes('colours')) randomizeColours(design);
  if (aspects.includes('seed')) design.seed = randomSeed();
}

const MODES: RenderMode[] = ['flat', 'woven', 'realistic'];

/** Short URL names for render settings. */
const RENDER_URL_NAMES: Record<string, string> = {
  threadPx: 'thread',
  step: 'step',
  bleed: 'bleed',
  warpJitter: 'warp',
  weftJitter: 'weft',
  sheen: 'sheen',
  texture: 'texture',
  threads: 'threads',
};

/** URL prefixes for the parameter groups. */
const PREFIX = { body: 'p.', layout: 'l.', zone: 'z.', exhibition: 'x.' };

/** All query values whose name starts with `prefix`, keyed by the rest of the name. */
function withPrefix(query: URLSearchParams, prefix: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of query) if (name.startsWith(prefix)) values[name.slice(prefix.length)] = value;
  return values;
}

function readParams(schema: ParamSchema, current: Params, overrides: Record<string, string>): Params {
  return sanitizeParams(schema, { ...current, ...overrides });
}

function writeParams(query: URLSearchParams, prefix: string, schema: ParamSchema, values: Params): void {
  for (const def of schema) query.set(prefix + def.key, formatValue(def, values[def.key]));
}

/** Apply `z.<zone>=<generator>` and `z.<zone>.<param>=<value>` to one zone. */
function readZone(query: URLSearchParams, zoneId: string, fill: ZoneFill): void {
  const generator = findGenerator(query.get(PREFIX.zone + zoneId) ?? '');
  if (generator && generator.id !== fill.generator) {
    fill.generator = generator.id;
    fill.params = {};
  }
  fill.params = readParams(
    getGenerator(fill.generator).params,
    fill.params,
    withPrefix(query, `${PREFIX.zone}${zoneId}.`),
  );
}

export function parseUrl(search: string): UrlState {
  const query = new URLSearchParams(search);
  const design = defaultDesign();

  const layout = findLayout(query.get('layout') ?? '');
  if (layout) applyLayout(design, layout.id);
  design.layoutSettings = readParams(
    getLayout(design.layout).settings,
    design.layoutSettings,
    withPrefix(query, PREFIX.layout),
  );

  const bodyGenerator = findGenerator(query.get('gen') ?? '');
  if (bodyGenerator && bodyGenerator.id !== design.generator) {
    design.generator = bodyGenerator.id;
    design.params = {};
  }
  design.params = readParams(getGenerator(design.generator).params, design.params, withPrefix(query, PREFIX.body));
  for (const zone of getLayout(design.layout).zones) {
    design.zones[zone.id] = zoneFill(design, zone.id);
    readZone(query, zone.id, design.zones[zone.id]);
  }

  const seed = query.get('seed');
  if (seed === 'random') design.seed = randomSeed();
  else if (seed !== null && /^\d+$/.test(seed)) design.seed = Math.min(MAX_SEED, Number(seed));

  const palette = query.get('palette');
  const preset = palette ? getPalette(palette) : undefined;
  const customColours = palette && !preset ? parseHexList(palette) : null;
  if (preset) {
    design.paletteId = preset.id;
    design.palette = [...preset.colors];
  } else if (customColours) {
    design.paletteId = null;
    design.palette = customColours;
  }

  const mode = query.get('mode');
  if (MODES.includes(mode as RenderMode)) design.mode = mode as RenderMode;

  for (const def of RENDER_SCHEMA) {
    const raw = query.get(RENDER_URL_NAMES[def.key] ?? def.key);
    if (raw !== null) design.render[def.key] = sanitizeValue(def, raw);
  }

  const width = Number(query.get('w'));
  const height = Number(query.get('h'));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    design.size = { width: clampSize(width), height: clampSize(height) };
  }

  const randomAspects = (query.get('random') ?? '')
    .split(',')
    .filter((aspect) => (RANDOM_ASPECTS as readonly string[]).includes(aspect));
  applyRandom(design, randomAspects);

  const format = query.get('download') as ExportFormat;
  const longSide = Number(query.get('size'));
  const download = EXPORT_FORMATS.includes(format)
    ? {
        format,
        longSide:
          Number.isFinite(longSide) && longSide > 0
            ? Math.min(MAX_EXPORT_SIDE, Math.max(64, Math.round(longSide)))
            : null,
      }
    : null;

  const view = VIEWS.find((candidate) => candidate === query.get('view')) ?? 'editor';
  const exhibition = readParams(EXHIBITION_SCHEMA, {}, withPrefix(query, PREFIX.exhibition));
  return { design, view, download, exhibition };
}

/** The share query of a design; exhibition links also carry the exhibition settings. */
export function designToQuery(design: Design, view: View = 'editor', exhibition?: Params): string {
  const query = new URLSearchParams();
  const layout = getLayout(design.layout);
  query.set('v', String(URL_VERSION));
  if (layout.id !== 'tile') query.set('layout', layout.id);
  writeParams(query, PREFIX.layout, layout.settings, design.layoutSettings);

  query.set('gen', design.generator);
  writeParams(query, PREFIX.body, getGenerator(design.generator).params, design.params);
  for (const zone of layout.zones) {
    const fill = zoneFill(design, zone.id);
    query.set(PREFIX.zone + zone.id, fill.generator);
    writeParams(query, `${PREFIX.zone}${zone.id}.`, getGenerator(fill.generator).params, fill.params);
  }

  query.set('seed', String(design.seed));
  // Presets by name; saved (browser-only) and edited palettes as hex so links work anywhere.
  const preset = design.paletteId ? getPalette(design.paletteId) : undefined;
  query.set('palette', preset ? preset.id : design.palette.map((colour) => colour.slice(1)).join(','));
  query.set('mode', design.mode);
  if (design.size) {
    query.set('w', String(design.size.width));
    query.set('h', String(design.size.height));
  }
  for (const def of RENDER_SCHEMA)
    query.set(RENDER_URL_NAMES[def.key] ?? def.key, formatValue(def, design.render[def.key]));
  if (view !== 'editor') query.set('view', view);
  if (view === 'exhibition' && exhibition) writeParams(query, PREFIX.exhibition, EXHIBITION_SCHEMA, exhibition);
  return query.toString();
}
