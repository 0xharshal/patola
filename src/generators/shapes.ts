/** Small geometry helpers shared by generators. All coordinates are in design cells. */
import { SLOT } from './types';

/** Modulo that is never negative. */
export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export interface TilePosition {
  /** Cell centre relative to the centre of its repeat. */
  dx: number;
  dy: number;
  column: number;
  row: number;
}

/**
 * Where cell (x, y) sits inside a repeating tile of tileWidth × tileHeight.
 * Half-drop shifts every other column of tiles down by half a tile.
 */
export function tilePosition(
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
  halfDrop = false,
): TilePosition {
  const column = Math.floor(x / tileWidth);
  const shiftedY = halfDrop && (column & 1) === 1 ? y + Math.floor(tileHeight / 2) : y;
  return {
    dx: positiveModulo(x, tileWidth) + 0.5 - tileWidth / 2,
    dy: positiveModulo(shiftedY, tileHeight) + 0.5 - tileHeight / 2,
    column,
    row: Math.floor(shiftedY / tileHeight),
  };
}

/** Fill a grid by calling `slotAt` for every cell. */
export function fillGrid(width: number, height: number, slotAt: (x: number, y: number) => number): Uint8Array {
  const grid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) grid[y * width + x] = slotAt(x, y);
  }
  return grid;
}

/**
 * Outline every shape: a non-ground cell that touches ground (4-neighbourhood)
 * becomes the outline slot. Gives the dark contour typical of patola motifs.
 */
export function outlineShapes(grid: Uint8Array, width: number, height: number): Uint8Array {
  const outlined = grid.slice();
  const isGround = (index: number) => grid[index] === SLOT.ground;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (isGround(index)) continue;
      const touchesGround =
        (x > 0 && isGround(index - 1)) ||
        (x < width - 1 && isGround(index + 1)) ||
        (y > 0 && isGround(index - width)) ||
        (y < height - 1 && isGround(index + width));
      if (touchesGround) outlined[index] = SLOT.outline;
    }
  }
  return outlined;
}

/** Slot order for banded patterns, by number of colours. */
export const BAND_SLOT_SEQUENCES: Record<number, number[]> = {
  2: [SLOT.ground, SLOT.primary],
  3: [SLOT.ground, SLOT.primary, SLOT.secondary],
  4: [SLOT.ground, SLOT.primary, SLOT.accent, SLOT.secondary],
  5: [SLOT.ground, SLOT.primary, SLOT.accent, SLOT.secondary, SLOT.outline],
};

export function bandSequence(colourCount: number): number[] {
  return BAND_SLOT_SEQUENCES[colourCount] ?? BAND_SLOT_SEQUENCES[4];
}

/** Triangle wave rising from 0 to `amplitude` and back over one `period`. */
export function triangleWave(position: number, period: number, amplitude: number): number {
  return Math.round(amplitude * (1 - Math.abs((positiveModulo(position, period) / period) * 2 - 1)));
}
