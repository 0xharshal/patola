/**
 * Endless fabric: an unbounded patchwork of square panels, each its own design,
 * gliding past the screen. Pure functions: where the camera is at a time, which
 * panels it needs, and the design of each panel.
 */
import { applyLayout, type Design } from '../core/design';
import { mulberry32, type Rng } from '../core/rng';
import { patternOnly } from '../layouts/registry';
import type { Size } from '../layouts/types';
import { nextDesign, type ExhibitionSettings } from './settings';

/** Seconds the cloth keeps one direction, and seconds a turn to the next takes. */
const STRAIGHT_SECONDS = 22;
const TURN_SECONDS = 6;
/** Gliding speed in screen sizes (the shorter side) per second: calm. */
const SPEED = 0.05;

type Direction = readonly [number, number];
const DIRECTIONS: readonly Direction[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Directions of the stretches: a quarter turn left or right each time, never a sudden reversal. */
function* directions(seed: number): Generator<Direction> {
  const random = mulberry32(seed);
  let index = Math.floor(random() * 4);
  for (;;) {
    yield DIRECTIONS[index];
    index = (index + (random() < 0.5 ? 1 : 3)) % 4;
  }
}

/** ∫₀ᵘ smoothstep: how far a smooth turn has carried the new direction's share. */
function easedDistance(u: number): number {
  return u * u * u - (u * u * u * u) / 2;
}

/**
 * Camera centre (in threads; may be negative) after `seconds` of gliding at
 * `threadsPerSecond`. Each stretch starts with a smooth turn from the previous
 * direction (the first from rest), so speed changes gently and never jumps.
 */
export function fabricCentre(seconds: number, threadsPerSecond: number, seed: number): [number, number] {
  let [x, y] = [0, 0];
  let previous: Direction = [0, 0];
  let remaining = seconds;
  for (const direction of directions(seed)) {
    const elapsed = Math.min(remaining, STRAIGHT_SECONDS + TURN_SECONDS);
    // While turning, velocity eases from the previous direction to the new one.
    const turning = Math.min(elapsed, TURN_SECONDS) / TURN_SECONDS;
    const alongNew = easedDistance(turning) * TURN_SECONDS + Math.max(0, elapsed - TURN_SECONDS);
    const alongPrevious = turning * TURN_SECONDS - easedDistance(turning) * TURN_SECONDS;
    x += (previous[0] * alongPrevious + direction[0] * alongNew) * threadsPerSecond;
    y += (previous[1] * alongPrevious + direction[1] * alongNew) * threadsPerSecond;
    remaining -= elapsed;
    if (remaining <= 0) break;
    previous = direction;
  }
  return [x, y];
}

/** Gliding speed in threads per second for a screen and scale. */
export function fabricSpeed(viewport: Size, scale: number): number {
  return (SPEED * Math.min(viewport.width, viewport.height)) / scale;
}

/** Side of a panel in threads: about one screen size, a whole number of design cells. */
export function panelSize(viewport: Size, scale: number, threadsPerCell: number): number {
  const threads = Math.min(viewport.width, viewport.height) / scale;
  return Math.max(threadsPerCell * 8, Math.round(threads / threadsPerCell) * threadsPerCell);
}

/** Panels (column, row) overlapping the area from (x, y), width × height threads. */
export function panelsIn(x: number, y: number, width: number, height: number, panel: number): [number, number][] {
  const panels: [number, number][] = [];
  for (let row = Math.floor(y / panel); row * panel < y + height; row++)
    for (let column = Math.floor(x / panel); column * panel < x + width; column++) panels.push([column, row]);
  return panels;
}

/** Different but stable randomness per panel. */
function panelRandom(seed: number, column: number, row: number): Rng {
  return mulberry32((Math.imul(column, 0x9e3779b1) ^ Math.imul(row, 0x85ebca6b) ^ seed) >>> 0);
}

/**
 * Design of one panel: `base` as a single pattern, changed as `vary` says
 * (panel 0, 0 shows `base` unchanged when nothing should vary).
 */
export function panelDesign(base: Design, vary: ExhibitionSettings['vary'], column: number, row: number): Design {
  const pattern: Design = JSON.parse(JSON.stringify(base));
  if (pattern.layout !== patternOnly.id) applyLayout(pattern, patternOnly.id);
  pattern.size = null;
  if (column === 0 && row === 0) return pattern;
  return nextDesign(pattern, vary, panelRandom(base.seed, column, row), [patternOnly]);
}
