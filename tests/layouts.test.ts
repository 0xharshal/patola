import { describe, expect, it } from 'vitest';
import { applyLayout, defaultDesign } from '../src/core/design';
import { compose, MAX_CELLS_PER_SIDE } from '../src/core/compose';
import { LAYOUTS } from '../src/layouts/registry';
import { defaultParams } from '../src/core/params';
import { ZARI_SLOT } from '../src/generators/types';
import { getGenerator } from '../src/generators/registry';

const screen = { width: 1200, height: 800 };

describe('layouts', () => {
  for (const layout of LAYOUTS) {
    it(`${layout.id}: regions stay inside the piece and cover all of it`, () => {
      const settings = defaultParams(layout.settings);
      const size = layout.size(settings, { width: 300, height: 200 });
      const covered = new Uint8Array(size.width * size.height);
      for (const region of layout.regions(settings, size)) {
        expect(region.x).toBeGreaterThanOrEqual(0);
        expect(region.y).toBeGreaterThanOrEqual(0);
        expect(region.x + region.width).toBeLessThanOrEqual(size.width);
        expect(region.y + region.height).toBeLessThanOrEqual(size.height);
        const zoneIds = [undefined, 'body', ...layout.zones.map((zone) => zone.id)];
        expect(zoneIds).toContain(region.zone);
        for (let y = region.y; y < region.y + region.height; y++) {
          for (let x = region.x; x < region.x + region.width; x++) covered[y * size.width + x] = 1;
        }
      }
      expect(covered.every((cell) => cell === 1)).toBe(true);
    });

    it(`${layout.id}: composes into valid slots`, () => {
      const design = defaultDesign();
      applyLayout(design, layout.id);
      const { grid } = compose(design, screen);
      expect(grid.slots).toHaveLength(grid.width * grid.height);
      expect(grid.width).toBeLessThanOrEqual(MAX_CELLS_PER_SIDE);
      for (const slot of grid.slots) expect(slot <= 4 || slot === ZARI_SLOT).toBe(true);
    });
  }

  it('pattern-only fills the screen size at the thread size', () => {
    const design = defaultDesign();
    design.render.threadPx = 4;
    design.render.step = 2;
    const { grid } = compose(design, { width: 800, height: 400 });
    expect([grid.width, grid.height]).toEqual([100, 50]);
  });

  it('gharchola has zari lines', () => {
    const design = defaultDesign();
    applyLayout(design, 'gharchola');
    expect(compose(design, screen).grid.slots).toContain(ZARI_SLOT);
  });

  it('gharchola squares hold one whole motif by default, whatever the repeat setting', () => {
    const gridFor = (repeat: number, halfDrop: boolean, oneMotif = true) => {
      const design = defaultDesign();
      applyLayout(design, 'gharchola');
      design.layoutSettings.oneMotif = oneMotif;
      design.generator = 'diamonds';
      design.params = { ...defaultParams(getGenerator('diamonds').params), repeat, halfDrop };
      design.zones.cellB.params = { ...design.zones.cellB.params, repeat: repeat + 5, halfDrop };
      return compose(design, screen).grid.slots;
    };
    // The squares are 24 cells: a 32-cell half-dropped repeat must look the same as a 24-cell one.
    expect(gridFor(32, true)).toEqual(gridFor(24, false));
    // Turned off, the pattern's own repeat applies.
    expect(gridFor(32, true, false)).not.toEqual(gridFor(24, false, false));
  });

  it('switching layout gives every zone a pattern', () => {
    const design = defaultDesign();
    applyLayout(design, 'saree');
    expect(Object.keys(design.zones).sort()).toEqual(['band', 'border', 'pallu']);
  });
});
