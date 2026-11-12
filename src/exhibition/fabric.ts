/**
 * Endless fabric: an unbounded patchwork of panels, each its own design and a
 * bit larger than the screen, gliding past. Pure functions: where the camera is at a time, which
 * panels it needs, and the design of each panel.
 */
import { applyLayout, type Design } from '../core/design';
import { mulberry32, type Rng } from '../core/rng';
import { patternOnly } from '../layouts/registry';
import type { Size } from '../layouts/types';
import { nextDesign, type ExhibitionSettings } from './settings';

/** Gliding speed in screen sizes (the shorter side) per second: calm. */
const SPEED = 0.05;
/** Seconds each design fills the whole screen as the cloth glides past it, at least. */
export const FULL_SCREEN_SECONDS = 5;
/** Radius of the curve at each turn, in screen sizes. */
const TURN_RADIUS = 0.15;
/** Panels the cloth runs straight across between turns: 1 up to this many. */
const LONGEST_RUN = 3;

type Direction = readonly [number, number];
const DIRECTIONS: readonly Direction[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** How the cloth glides: panel size and turn radius in threads, speed in threads per second. */
export interface FabricMotion {
  panel: Size;
  turnRadius: number;
  speed: number;
  /** How far before a panel's middle the screen is first filled by it (half the margin). */
  lead: number;
}

/**
 * Panels a bit larger than the screen both ways, so a design fills the whole
 * screen for FULL_SCREEN_SECONDS as it glides past, with room for the curve of a
 * turn; a whole number of design cells. `scale`: pixels per thread.
 */
export function fabricMotion(viewport: Size, scale: number, threadsPerCell: number): FabricMotion {
  const screen = Math.min(viewport.width, viewport.height) / scale;
  const speed = SPEED * screen;
  const margin = speed * FULL_SCREEN_SECONDS + 2 * TURN_RADIUS * screen * 0.5;
  const cells = (threads: number) => Math.max(8, Math.ceil(threads / threadsPerCell)) * threadsPerCell;
  return {
    panel: { width: cells(viewport.width / scale + margin), height: cells(viewport.height / scale + margin) },
    turnRadius: TURN_RADIUS * screen,
    speed,
    lead: margin / 2,
  };
}

/**
 * Camera centre (threads) after `seconds`. The cloth glides at a constant speed
 * along the centre lines of the panels, straight across 1 to LONGEST_RUN panels,
 * then turns a quarter left or right on a gentle curve centred on a panel's
 * middle, never reversing. Running along centre lines keeps each design filling
 * the screen while it passes.
 */
export function fabricCentre(
  seconds: number,
  { panel, turnRadius, speed, lead }: FabricMotion,
  seed: number,
): [number, number] {
  const random = mulberry32(seed);
  let direction = DIRECTIONS[Math.floor(random() * 4)];
  // Start where the first panel begins to fill the screen, so it gets its full time too.
  let [x, y] = [panel.width / 2 - direction[0] * lead, panel.height / 2 - direction[1] * lead];
  let distance = Math.max(0, seconds) * speed;
  let curvedIn = -lead; // how far into this run (from a panel's middle) we already are
  for (;;) {
    const panels = 1 + Math.floor(random() * LONGEST_RUN);
    const run = panels * (direction[0] !== 0 ? panel.width : panel.height);
    const straight = run - curvedIn - turnRadius;
    if (distance <= straight) return [x + direction[0] * distance, y + direction[1] * distance];
    distance -= straight;
    // Quarter circle from `turnRadius` before the corner to `turnRadius` after it.
    const next = DIRECTIONS[(DIRECTIONS.indexOf(direction) + (random() < 0.5 ? 1 : 3)) % 4];
    const [startX, startY] = [x + direction[0] * straight, y + direction[1] * straight];
    const arc = (Math.PI / 2) * turnRadius;
    const along = Math.min(distance, arc) / turnRadius; // radians turned
    // Centre of the curve: one radius to the side we turn to.
    const [centreX, centreY] = [startX + next[0] * turnRadius, startY + next[1] * turnRadius];
    const pointX = centreX - next[0] * turnRadius * Math.cos(along) + direction[0] * turnRadius * Math.sin(along);
    const pointY = centreY - next[1] * turnRadius * Math.cos(along) + direction[1] * turnRadius * Math.sin(along);
    if (distance <= arc) return [pointX, pointY];
    distance -= arc;
    [x, y] = [pointX, pointY];
    direction = next;
    curvedIn = turnRadius;
  }
}

/** Panels (column, row) overlapping the area from (x, y), width × height threads. */
export function panelsIn(x: number, y: number, width: number, height: number, panel: Size): [number, number][] {
  const panels: [number, number][] = [];
  for (let row = Math.floor(y / panel.height); row * panel.height < y + height; row++)
    for (let column = Math.floor(x / panel.width); column * panel.width < x + width; column++)
      panels.push([column, row]);
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
