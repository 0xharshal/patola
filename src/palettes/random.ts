import type { Rng } from '../core/rng';
import { hexToRgb, SLOT_COUNT } from './presets';

/** Colours close to traditional natural and early synthetic dyes. */
const GROUNDS = [
  '#8f1d21',
  '#b3202a',
  '#6e1423',
  '#c2511c',
  '#d99a1b',
  '#2f7d3a',
  '#0f6b5c',
  '#1f2f5c',
  '#3b5b92',
  '#4e1660',
  '#a8573f',
  '#b0263a',
];
const MIDS = [...GROUNDS, '#e8c547', '#c9a66b', '#d4637a', '#e2725b'];
const LIGHTS = ['#f3ead8', '#efe3c8', '#e8c547', '#f2d04a', '#f0c9a0', '#c9a66b'];
const DARKS = ['#151515', '#151515', '#151515', '#2a0f14', '#13132b', '#1c1020'];

function colourDistance(first: string, second: string): number {
  const [red1, green1, blue1] = hexToRgb(first);
  const [red2, green2, blue2] = hexToRgb(second);
  return Math.hypot(red1 - red2, green1 - green2, blue1 - blue2);
}

function pick<T>(list: T[], random: Rng): T {
  return list[Math.floor(random() * list.length)];
}

/** Pick a colour from `list` that is at least `minDistance` away from all of `others` (best effort). */
function pickDistinct(list: string[], others: string[], minDistance: number, random: Rng): string {
  let best = pick(list, random);
  let bestScore = -1;
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = pick(list, random);
    const score = Math.min(...others.map((other) => colourDistance(candidate, other)));
    if (score >= minDistance) return candidate;
    if (score > bestScore) [best, bestScore] = [candidate, score];
  }
  return best;
}

/**
 * A random but harmonious palette: dye-like ground, a contrasting primary and
 * secondary, a light accent and a dark outline. Locked slots are kept.
 */
export function randomPalette(random: Rng, current?: string[], locked: boolean[] = []): string[] {
  const keep = (slot: number) => (current && locked[slot] ? current[slot] : null);
  const ground = keep(0) ?? pick(GROUNDS, random);
  const primary = keep(1) ?? pickDistinct(MIDS, [ground], 130, random);
  const secondary = keep(2) ?? pickDistinct(MIDS, [ground, primary], 100, random);
  const accent = keep(3) ?? pickDistinct(LIGHTS, [ground, primary, secondary], 80, random);
  const outline = keep(4) ?? pick(DARKS, random);
  return [ground, primary, secondary, accent, outline].slice(0, SLOT_COUNT);
}

/** Shuffle the unlocked colours among the unlocked slots. */
export function shufflePalette(colors: string[], locked: boolean[], random: Rng): string[] {
  const free = colors.map((_, slot) => slot).filter((slot) => !locked[slot]);
  const values = free.map((slot) => colors[slot]);
  for (let index = values.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    [values[index], values[swapWith]] = [values[swapWith], values[index]];
  }
  const shuffled = [...colors];
  free.forEach((slot, position) => (shuffled[slot] = values[position]));
  return shuffled;
}
