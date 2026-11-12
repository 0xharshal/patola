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
export function fabricMotion(
  viewport: Size,
  scale: number,
  threadsPerCell: number,
  screensPerSecond: number,
): FabricMotion {
  const screen = Math.min(viewport.width, viewport.height) / scale;
  const speed = screensPerSecond * screen;
  // Room for 5 s of gliding, and for the curve of a turn (one radius).
  const margin = speed * FULL_SCREEN_SECONDS + TURN_RADIUS * screen;
  const cells = (threads: number) => Math.max(8, Math.ceil(threads / threadsPerCell)) * threadsPerCell;
  return {
    panel: { width: cells(viewport.width / scale + margin), height: cells(viewport.height / scale + margin) },
    turnRadius: TURN_RADIUS * screen,
    speed,
    lead: margin / 2,
  };
}

/** One straight run across panels and the quarter turn that ends it. */
interface Run {
  /** Distance travelled (threads) when the run starts, and its straight part's start. */
  from: number;
  x: number;
  y: number;
  direction: Direction;
  straight: number;
  /** Direction after the turn. */
  next: Direction;
}

/**
 * The path the cloth glides along: at a constant speed along the centre lines of
 * the panels, straight across 1 to LONGEST_RUN panels, then a quarter turn left
 * or right on a gentle curve centred on a panel's middle, never reversing.
 * Running along centre lines keeps each design filling the screen while it
 * passes. Runs are worked out once and kept, so asking for the centre at a time
 * costs little however long the fabric has been running.
 */
export class FabricPath {
  private readonly runs: Run[] = [];
  private readonly random: Rng;
  private readonly arc: number;

  constructor(
    readonly motion: FabricMotion,
    seed: number,
  ) {
    const { panel, lead } = motion;
    this.random = mulberry32(seed);
    const direction = DIRECTIONS[Math.floor(this.random() * 4)];
    this.arc = (Math.PI / 2) * motion.turnRadius;
    // Start where the first panel begins to fill the screen, so it gets its full time too.
    this.addRun(0, panel.width / 2 - direction[0] * lead, panel.height / 2 - direction[1] * lead, direction, -lead);
  }

  /** `curvedIn`: how far into this run (from a panel's middle) it starts. */
  private addRun(from: number, x: number, y: number, direction: Direction, curvedIn: number): Run {
    const { panel, turnRadius } = this.motion;
    const panels = 1 + Math.floor(this.random() * LONGEST_RUN);
    const length = panels * (direction[0] !== 0 ? panel.width : panel.height);
    const next = DIRECTIONS[(DIRECTIONS.indexOf(direction) + (this.random() < 0.5 ? 1 : 3)) % 4];
    const run = { from, x, y, direction, straight: length - curvedIn - turnRadius, next };
    this.runs.push(run);
    return run;
  }

  /** Where `run` is after travelling `distance` along it (straight, then the turn). */
  private pointOn(run: Run, distance: number): [number, number] {
    const { direction, next, straight } = run;
    if (distance <= straight) return [run.x + direction[0] * distance, run.y + direction[1] * distance];
    const radius = this.motion.turnRadius;
    const turned = Math.min(distance - straight, this.arc) / radius; // radians
    // The curve's centre lies one radius towards the side it turns to.
    const centreX = run.x + direction[0] * straight + next[0] * radius;
    const centreY = run.y + direction[1] * straight + next[1] * radius;
    return [
      centreX - next[0] * radius * Math.cos(turned) + direction[0] * radius * Math.sin(turned),
      centreY - next[1] * radius * Math.cos(turned) + direction[1] * radius * Math.sin(turned),
    ];
  }

  /** Camera centre (threads) after `seconds`. */
  centreAt(seconds: number): [number, number] {
    const distance = Math.max(0, seconds) * this.motion.speed;
    let last = this.runs[this.runs.length - 1];
    while (last.from + last.straight + this.arc < distance) {
      const [x, y] = this.pointOn(last, last.straight + this.arc);
      last = this.addRun(last.from + last.straight + this.arc, x, y, last.next, this.motion.turnRadius);
    }
    // The run holding `distance`: binary search, as times may also go back (previous, pause).
    let [low, high] = [0, this.runs.length - 1];
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.runs[middle].from <= distance) low = middle;
      else high = middle - 1;
    }
    return this.pointOn(this.runs[low], distance - this.runs[low].from);
  }
}

/** Camera centre (threads) after `seconds` (see FabricPath). */
export function fabricCentre(seconds: number, motion: FabricMotion, seed: number): [number, number] {
  return new FabricPath(motion, seed).centreAt(seconds);
}

/**
 * Times the area the view sweeps over that panels are prepared at: the panels
 * after a turn are all needed within a few seconds.
 */
const PREPARATION_HEADROOM = 36;

/** Pixels of upcoming panels to render per second: in step with how fast new cloth comes into view. */
export function fabricPreparationRate({ panel, speed }: FabricMotion, scale: number): number {
  return PREPARATION_HEADROOM * speed * Math.max(panel.width, panel.height) * scale * scale;
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
 * Design of one panel: `base` as a single pattern, changed as `vary` says, with
 * randomness from `seed` (the exhibition's); panel 0, 0 shows `base` itself.
 */
export function panelDesign(
  base: Design,
  vary: ExhibitionSettings['vary'],
  column: number,
  row: number,
  seed: number,
): Design {
  const pattern: Design = JSON.parse(JSON.stringify(base));
  if (pattern.layout !== patternOnly.id) applyLayout(pattern, patternOnly.id);
  pattern.size = null;
  if (column === 0 && row === 0) return pattern;
  return nextDesign(pattern, vary, panelRandom(seed, column, row), [patternOnly]);
}
