import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../src/core/design';
import { randomizeColours } from '../src/core/randomize';
import { mulberry32 } from '../src/core/rng';
import { normalizeHex, PALETTES, parseHexList, SLOT_COUNT } from '../src/palettes/presets';
import { randomPalette, shufflePalette } from '../src/palettes/random';
import { extractPalette, quantizeImage } from '../src/palettes/extract';

describe('palettes', () => {
  it('presets all have one colour per slot', () => {
    for (const preset of PALETTES) expect(preset.colors).toHaveLength(SLOT_COUNT);
  });

  it('parses hex lists and repeats short ones', () => {
    expect(parseHexList('ff0000,00FF00')).toEqual(['#ff0000', '#00ff00', '#ff0000', '#00ff00', '#ff0000']);
    expect(parseHexList('ff0000,nothex')).toBeNull();
  });

  it('random palettes are valid hex', () => {
    const random = mulberry32(9);
    for (let i = 0; i < 50; i++) {
      const palette = randomPalette(random);
      expect(palette).toHaveLength(SLOT_COUNT);
      palette.forEach((colour) => expect(normalizeHex(colour)).toBe(colour));
    }
  });

  it('keeps locked colours when randomising', () => {
    const design = defaultDesign();
    const before = [...design.palette];
    for (let i = 0; i < 10; i++) randomizeColours(design, [true, false, false, false, true], mulberry32(i));
    expect(design.palette[0]).toBe(before[0]);
    expect(design.palette[4]).toBe(before[4]);
  });

  it('shuffle only moves unlocked colours', () => {
    const colours = ['#000001', '#000002', '#000003', '#000004', '#000005'];
    const shuffled = shufflePalette(colours, [false, true, false, true, false], mulberry32(3));
    expect(shuffled[1]).toBe('#000002');
    expect(shuffled[3]).toBe('#000004');
    expect([...shuffled].sort()).toEqual([...colours].sort());
  });
});

describe('image colours', () => {
  // Five flat colour blocks of different sizes.
  const blocks: [number, number, number, number][] = [
    [200, 30, 30, 400], // red: most common → ground
    [20, 40, 120, 200],
    [230, 200, 60, 150],
    [240, 235, 220, 100],
    [10, 10, 10, 50], // black: darkest → outline
  ];
  const pixels = new Uint8ClampedArray(
    blocks.flatMap(([red, green, blue, count]) => Array.from({ length: count }, () => [red, green, blue, 255]).flat()),
  );

  it('finds the main colours, most common first, darkest last', () => {
    const palette = extractPalette(pixels)!;
    expect(palette[0]).toBe('#c81e1e');
    expect(palette[4]).toBe('#0a0a0a');
    expect(new Set(palette).size).toBe(5);
  });

  it('maps every pixel to the slot of its colour', () => {
    const { slots } = quantizeImage(pixels)!;
    expect(slots[0]).toBe(0); // first red pixel → ground
    expect(slots[pixels.length / 4 - 1]).toBe(4); // last black pixel → outline
  });

  it('keeps a cut-out motif off the ground slot', () => {
    // 60 % transparent background, then a blue motif with a dark eye.
    const cutOut = new Uint8ClampedArray([
      ...Array.from({ length: 600 }, () => [0, 0, 0, 0]).flat(),
      ...Array.from({ length: 380 }, () => [40, 60, 140, 255]).flat(),
      ...Array.from({ length: 20 }, () => [10, 10, 10, 255]).flat(),
    ]);
    const { slots, colours } = quantizeImage(cutOut)!;
    expect(slots[0]).toBe(0); // background → ground
    expect(slots[600]).toBe(1); // most common motif colour → primary, not ground
    expect(slots[999]).toBe(4); // darkest → outline
    expect(colours[0]).toBe(''); // no ground colour suggested
  });

  it('returns null for an empty or transparent image', () => {
    expect(extractPalette(new Uint8ClampedArray(16))).toBeNull();
  });
});
