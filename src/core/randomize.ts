import type { Design } from './design';
import { sanitizeValue, type ParamSchema, type Params } from './params';
import { mulberry32, randomSeed, type Rng } from './rng';
import { GENERATORS, getGenerator } from '../generators/registry';
import type { ZoneFill } from '../layouts/types';
import { PALETTES } from '../palettes/presets';
import { randomPalette } from '../palettes/random';

const freshRandom = (): Rng => mulberry32(randomSeed());

/** Random values for a schema, using each number's `random` range when given. */
export function randomParams(schema: ParamSchema, random: Rng): Params {
  const values: Params = {};
  for (const def of schema) {
    switch (def.type) {
      case 'int':
      case 'float': {
        const [low, high] = def.random ?? [def.min, def.max];
        const raw = def.type === 'int' ? low + Math.floor(random() * (high - low + 1)) : low + random() * (high - low);
        values[def.key] = sanitizeValue(def, raw);
        break;
      }
      case 'bool':
        values[def.key] = random() < 0.5;
        break;
      case 'select':
        values[def.key] = def.options[Math.floor(random() * def.options.length)].value;
        break;
      default:
        // Code and image choices are the user's own content: never randomised.
        values[def.key] = def.default;
    }
  }
  return values;
}

/** New pattern parameters for one zone, keeping its generator and any user content. */
export function randomizePattern(fill: ZoneFill, random: Rng = freshRandom()): void {
  const schema = getGenerator(fill.generator).params;
  const userContentKeys = schema.filter((def) => def.type === 'code' || def.type === 'asset').map((def) => def.key);
  const kept = Object.fromEntries(userContentKeys.map((key) => [key, fill.params[key]]));
  fill.params = { ...randomParams(schema, random), ...kept };
}

/** New colours: half the time a preset, otherwise a generated dye palette. Locked slots are kept. */
export function randomizeColours(design: Design, locked: boolean[] = [], random: Rng = freshRandom()): void {
  if (!locked.some(Boolean) && random() < 0.5) {
    const preset = PALETTES[Math.floor(random() * PALETTES.length)];
    design.paletteId = preset.id;
    design.palette = [...preset.colors];
  } else {
    design.paletteId = null;
    design.palette = randomPalette(random, design.palette, locked);
  }
}

/** Everything new: body pattern, settings of the other zones, colours and seed. */
export function surprise(design: Design, locked: boolean[] = [], random: Rng = freshRandom()): void {
  const candidates = GENERATORS.filter((generator) => !generator.userContent);
  design.generator = candidates[Math.floor(random() * candidates.length)].id;
  design.params = randomParams(getGenerator(design.generator).params, random);
  for (const fill of Object.values(design.zones)) randomizePattern(fill, random);
  randomizeColours(design, locked, random);
  design.seed = randomSeed();
}
