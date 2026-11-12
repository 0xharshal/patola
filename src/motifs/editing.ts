/** Pure grid operations behind the motif editor. Grids are edited in place unless stated. */
import type { MotifGrid } from './format';

export interface Mirror {
  /** Mirror left ↔ right (around the vertical centre line). */
  leftRight: boolean;
  /** Mirror top ↔ bottom. */
  topBottom: boolean;
}

export const NO_MIRROR: Mirror = { leftRight: false, topBottom: false };

export function blankGrid(width: number, height: number): MotifGrid {
  return { width, height, slots: new Uint8Array(width * height) };
}

export function copyGrid(grid: MotifGrid): MotifGrid {
  return { width: grid.width, height: grid.height, slots: grid.slots.slice() };
}

/** The cell and its mirror images (no duplicates). */
export function mirroredCells(grid: MotifGrid, x: number, y: number, mirror: Mirror): [number, number][] {
  const mirroredX = grid.width - 1 - x;
  const mirroredY = grid.height - 1 - y;
  const cells: [number, number][] = [[x, y]];
  if (mirror.leftRight) cells.push([mirroredX, y]);
  if (mirror.topBottom) cells.push([x, mirroredY]);
  if (mirror.leftRight && mirror.topBottom) cells.push([mirroredX, mirroredY]);
  return cells.filter(
    ([cellX, cellY], index) => cells.findIndex(([otherX, otherY]) => otherX === cellX && otherY === cellY) === index,
  );
}

function inside(grid: MotifGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

/** Paint one cell (and its mirror images). Returns true if anything changed. */
export function paintCell(grid: MotifGrid, x: number, y: number, slot: number, mirror: Mirror): boolean {
  let changed = false;
  for (const [cellX, cellY] of mirroredCells(grid, x, y, mirror)) {
    if (!inside(grid, cellX, cellY)) continue;
    const index = cellY * grid.width + cellX;
    if (grid.slots[index] !== slot) {
      grid.slots[index] = slot;
      changed = true;
    }
  }
  return changed;
}

/** Fill the connected area of equal cells (4-neighbourhood) around each mirrored start cell. */
export function floodFill(grid: MotifGrid, x: number, y: number, slot: number, mirror: Mirror): boolean {
  let changed = false;
  for (const [startX, startY] of mirroredCells(grid, x, y, mirror)) {
    if (!inside(grid, startX, startY)) continue;
    const target = grid.slots[startY * grid.width + startX];
    if (target === slot) continue;
    const stack: [number, number][] = [[startX, startY]];
    while (stack.length > 0) {
      const [cellX, cellY] = stack.pop()!;
      if (!inside(grid, cellX, cellY) || grid.slots[cellY * grid.width + cellX] !== target) continue;
      grid.slots[cellY * grid.width + cellX] = slot;
      changed = true;
      stack.push([cellX + 1, cellY], [cellX - 1, cellY], [cellX, cellY + 1], [cellX, cellY - 1]);
    }
  }
  return changed;
}

/** A new grid, flipped left ↔ right or top ↔ bottom. */
export function flipGrid(grid: MotifGrid, direction: 'leftRight' | 'topBottom'): MotifGrid {
  const flipped = blankGrid(grid.width, grid.height);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const sourceX = direction === 'leftRight' ? grid.width - 1 - x : x;
      const sourceY = direction === 'topBottom' ? grid.height - 1 - y : y;
      flipped.slots[y * grid.width + x] = grid.slots[sourceY * grid.width + sourceX];
    }
  }
  return flipped;
}

/** A new grid of the given size with the old content centred (cropped or padded with ground). */
export function resizeGrid(grid: MotifGrid, width: number, height: number): MotifGrid {
  const resized = blankGrid(width, height);
  const offsetX = Math.floor((width - grid.width) / 2);
  const offsetY = Math.floor((height - grid.height) / 2);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (inside(resized, targetX, targetY)) resized.slots[targetY * width + targetX] = grid.slots[y * grid.width + x];
    }
  }
  return resized;
}

/** Cells on a straight line between two cells (Bresenham), so fast strokes leave no gaps. */
export function cellsOnLine(fromX: number, fromY: number, toX: number, toY: number): [number, number][] {
  const cells: [number, number][] = [];
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  const distanceX = Math.abs(toX - fromX);
  const distanceY = -Math.abs(toY - fromY);
  let error = distanceX + distanceY;
  let x = fromX;
  let y = fromY;
  for (;;) {
    cells.push([x, y]);
    if (x === toX && y === toY) return cells;
    const doubled = 2 * error;
    if (doubled >= distanceY) {
      error += distanceY;
      x += stepX;
    }
    if (doubled <= distanceX) {
      error += distanceX;
      y += stepY;
    }
  }
}
