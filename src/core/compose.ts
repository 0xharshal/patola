import { cellsForPixels, zoneFill, type Design } from './design';
import { mulberry32 } from './rng';
import { getGenerator } from '../generators/registry';
import { getLayout } from '../layouts/registry';
import { BODY_ZONE, holdsOneMotif, type LayoutDef, type Region, type Size } from '../layouts/types';
import { oneMotifParams } from '../generators/commonParams';

/** Design grid: one palette slot per cell. */
export interface Grid extends Size {
  slots: Uint8Array;
}

export interface Composition {
  grid: Grid;
  layout: LayoutDef;
  regions: Region[];
}

/** WebGL2 guarantees textures of at least this size on every device we target. */
export const MAX_CELLS_PER_SIDE = 4096;

/** Different but stable randomness per zone, derived from the design seed. */
function zoneSeed(seed: number, zoneId: string): number {
  let hash = seed >>> 0;
  for (const char of zoneId) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

/** Copy a zone's pattern into its region of the piece, mirroring and clipping as needed. */
function paintRegion(grid: Grid, region: Region, pattern: Uint8Array): void {
  for (let row = 0; row < region.height; row++) {
    const targetY = region.y + row;
    if (targetY < 0 || targetY >= grid.height) continue;
    const sourceRow = region.flipY ? region.height - 1 - row : row;
    for (let column = 0; column < region.width; column++) {
      const targetX = region.x + column;
      if (targetX < 0 || targetX >= grid.width) continue;
      const sourceColumn = region.flipX ? region.width - 1 - column : column;
      grid.slots[targetY * grid.width + targetX] = pattern[sourceRow * region.width + sourceColumn];
    }
  }
}

function fillRegion(grid: Grid, region: Region, slot: number): void {
  paintRegion(grid, { ...region, flipX: false, flipY: false }, new Uint8Array(region.width * region.height).fill(slot));
}

/**
 * Build the design grid for the whole piece: lay out the zones, generate each
 * zone's pattern (once per zone and size) and paint it into its regions.
 */
export function compose(design: Design, screenPixels: Size): Composition {
  const layout = getLayout(design.layout);
  const requested = layout.size(design.layoutSettings, cellsForPixels(screenPixels, design.render));
  const size: Size = {
    width: Math.max(1, Math.min(MAX_CELLS_PER_SIDE, requested.width)),
    height: Math.max(1, Math.min(MAX_CELLS_PER_SIDE, requested.height)),
  };
  const regions = layout.regions(design.layoutSettings, size).filter((region) => region.width > 0 && region.height > 0);
  const grid: Grid = { ...size, slots: new Uint8Array(size.width * size.height) };
  const patterns = new Map<string, Uint8Array>();

  for (const region of regions) {
    if (region.fillSlot !== undefined) {
      fillRegion(grid, region, region.fillSlot);
      continue;
    }
    const zoneId = region.zone!;
    const fill = zoneFill(design, zoneId);
    const generator = getGenerator(fill.generator);
    const cacheKey = `${zoneId}:${region.width}x${region.height}`;
    let pattern = patterns.get(cacheKey);
    if (!pattern) {
      const seed = zoneSeed(design.seed, zoneId);
      const zone = zoneId === BODY_ZONE ? layout.body : layout.zones.find((candidate) => candidate.id === zoneId);
      const params = holdsOneMotif(zone, design.layoutSettings) ? oneMotifParams(fill.params, region) : fill.params;
      pattern = generator.generate(params, {
        width: region.width,
        height: region.height,
        random: mulberry32(seed),
        seed,
      });
      patterns.set(cacheKey, pattern);
    }
    // Mirroring one way only (not both, which is a half turn) would flip a saathiya.
    const mirrorsOneWay = Boolean(region.flipX) !== Boolean(region.flipY);
    const keep = mirrorsOneWay && generator.keepsHandedness?.(fill.params) === true;
    paintRegion(grid, keep ? { ...region, flipX: false, flipY: false } : region, pattern);
  }
  return { grid, layout, regions };
}
