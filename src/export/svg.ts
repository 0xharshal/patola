/**
 * SVG of the flat design: one path per colour. Runs of equal cells in a row
 * become one rectangle, and identical runs in consecutive rows are merged into
 * taller rectangles, which keeps files small. Woven and ikat effects are pixel
 * effects, so they are not part of the SVG.
 */
import type { Grid } from '../core/compose';
import { slotColour } from '../palettes/presets';

interface Run {
  slot: number;
  x: number;
  width: number;
  y: number;
  height: number;
}

/** Rectangles covering the grid, as described above. */
export function gridRectangles(grid: Grid): Run[] {
  const finished: Run[] = [];
  let open = new Map<string, Run>(); // runs that may continue into the next row, keyed by x:width:slot
  for (let y = 0; y < grid.height; y++) {
    const next = new Map<string, Run>();
    let x = 0;
    while (x < grid.width) {
      const slot = grid.slots[y * grid.width + x];
      let end = x + 1;
      while (end < grid.width && grid.slots[y * grid.width + end] === slot) end++;
      const key = `${x}:${end - x}:${slot}`;
      const above = open.get(key);
      if (above) {
        above.height++;
        open.delete(key);
        next.set(key, above);
      } else {
        next.set(key, { slot, x, width: end - x, y, height: 1 });
      }
      x = end;
    }
    for (const run of open.values()) finished.push(run); // runs that did not continue
    open = next;
  }
  for (const run of open.values()) finished.push(run);
  return finished;
}

/** Path data for one colour: a closed rectangle per run. */
function pathData(runs: Run[]): string {
  return runs.map((run) => `M${run.x} ${run.y}h${run.width}v${run.height}h${-run.width}z`).join('');
}

/**
 * @param pixelsPerCell nominal display size of one design cell (the SVG scales freely).
 */
export function buildSvg(grid: Grid, palette: string[], pixelsPerCell: number, title: string): string {
  const bySlot = new Map<number, Run[]>();
  for (const run of gridRectangles(grid)) {
    if (!bySlot.has(run.slot)) bySlot.set(run.slot, []);
    bySlot.get(run.slot)!.push(run);
  }
  const width = Math.round(grid.width * pixelsPerCell);
  const height = Math.round(grid.height * pixelsPerCell);
  const escapedTitle = title.replace(/[<&>"]/g, (character) => `&#${character.charCodeAt(0)};`);
  const paths = [...bySlot.entries()]
    .sort(([first], [second]) => first - second)
    .map(([slot, runs]) => `  <path fill="${slotColour(palette, slot)}" d="${pathData(runs)}"/>`)
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${grid.width} ${grid.height}" shape-rendering="crispEdges">`,
    `  <title>${escapedTitle}</title>`,
    paths,
    '</svg>',
    '',
  ].join('\n');
}
