import { describe, expect, it } from 'vitest';
import { BUILT_IN_MOTIFS } from '../src/motifs/builtin';
import { SYMBOLS, symbolGrid } from '../src/motifs/symbols';
import { getGenerator } from '../src/generators/registry';
import { defaultParams } from '../src/core/params';
import { mulberry32 } from '../src/core/rng';
import { motifFromFile, motifToFile, motifToRows, parseMotifRows } from '../src/motifs/format';
import { blankGrid, cellsOnLine, flipGrid, floodFill, NO_MIRROR, paintCell, resizeGrid } from '../src/motifs/editing';
import { getMotif, listMotifs } from '../src/motifs/library';
import { SLOT, ZARI_SLOT } from '../src/generators/types';

describe('motif format', () => {
  it('round-trips rows of characters', () => {
    const rows = ['.12', '3#Z', '...'];
    const grid = parseMotifRows(rows);
    expect([grid.width, grid.height]).toEqual([3, 3]);
    expect(grid.slots[5]).toBe(ZARI_SLOT);
    expect(motifToRows(grid)).toEqual(rows);
  });

  it('round-trips motif files and rejects others', () => {
    const grid = parseMotifRows(['1.1', '.2.']);
    const result = motifFromFile(JSON.parse(JSON.stringify(motifToFile('Test', grid))));
    expect(result).toMatchObject({ name: 'Test', motif: { width: 3, height: 2 } });
    expect(motifFromFile({ format: 'something-else' })).toHaveProperty('error');
    expect(motifFromFile({ format: 'patola-motif', rows: ['x'.repeat(500)] })).toHaveProperty('error');
  });
});

describe('built-in motifs', () => {
  it('are non-empty, use valid slots and are listed in the library', () => {
    for (const motif of BUILT_IN_MOTIFS) {
      expect(motif.slots.some((slot) => slot !== SLOT.ground)).toBe(true);
      expect(motif.slots.every((slot) => slot <= 4 || slot === ZARI_SLOT)).toBe(true);
      expect(getMotif(motif.id)?.builtIn).toBe(true);
    }
    expect(listMotifs().length).toBeGreaterThanOrEqual(BUILT_IN_MOTIFS.length);
  });

  it('are cropped to their drawing', () => {
    for (const { width, height, slots } of BUILT_IN_MOTIFS) {
      const rowUsed = (y: number) => slots.slice(y * width, (y + 1) * width).some(Boolean);
      expect(rowUsed(0) && rowUsed(height - 1)).toBe(true);
    }
  });
});

describe('motif editing', () => {
  it('paints with mirroring', () => {
    const grid = blankGrid(5, 4);
    paintCell(grid, 0, 0, SLOT.primary, { leftRight: true, topBottom: true });
    expect([grid.slots[0], grid.slots[4], grid.slots[15], grid.slots[19]]).toEqual([1, 1, 1, 1]);
  });

  it('flood fills only the connected area', () => {
    const grid = parseMotifRows(['..#..', '..#..']);
    floodFill(grid, 0, 0, SLOT.accent, NO_MIRROR);
    expect(motifToRows(grid)).toEqual(['33#..', '33#..']);
  });

  it('flips and resizes around the centre', () => {
    const grid = parseMotifRows(['12']);
    expect(motifToRows(flipGrid(grid, 'leftRight'))).toEqual(['21']);
    expect(motifToRows(resizeGrid(grid, 4, 3))).toEqual(['....', '.12.', '....']);
    expect(motifToRows(resizeGrid(parseMotifRows(['1234']), 2, 1))).toEqual(['23']);
  });

  it('draws gap-free lines', () => {
    const cells = cellsOnLine(0, 0, 5, 2);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells.at(-1)).toEqual([5, 2]);
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i][0] - cells[i - 1][0])).toBeLessThanOrEqual(1);
      expect(Math.abs(cells[i][1] - cells[i - 1][1])).toBeLessThanOrEqual(1);
    }
  });
});

describe('drawn symbols', () => {
  it('draw at any size, small or large', () => {
    for (const symbol of SYMBOLS) {
      for (const height of [10, 28, 80]) {
        const grid = symbolGrid(symbol, height);
        expect(grid.height).toBe(height);
        expect(grid.slots.filter((slot) => slot !== SLOT.ground && slot !== SLOT.outline).length).toBeGreaterThan(
          height,
        );
      }
    }
  });

  it('never mirror the saathiya or Om, but let figures face each other', () => {
    const generator = getGenerator('symbols');
    const zone = { width: 120, height: 60, random: mulberry32(1), seed: 1 };
    const repeat = (symbol: string, mirror: boolean) =>
      generator.generate({ ...defaultParams(generator.params), symbol, mirror, rotation: 0 }, zone);
    for (const symbol of ['saathiya', 'om']) expect(repeat(symbol, true)).toEqual(repeat(symbol, false));
    expect(repeat('mor', true)).not.toEqual(repeat('mor', false));
    // Also as a library motif in the Picture motif pattern.
    const picture = getGenerator('image');
    const pictureOf = (asset: string, mirror: boolean) =>
      picture.generate({ ...defaultParams(picture.params), asset, mirror, rotation: 0 }, zone);
    expect(pictureOf('builtin:saathiya', true)).toEqual(pictureOf('builtin:saathiya', false));
    expect(pictureOf('builtin:mor', true)).not.toEqual(pictureOf('builtin:mor', false));
  });
});
