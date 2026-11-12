import { describe, expect, it } from 'vitest';
import { defaultParams } from '../src/core/params';
import { mulberry32 } from '../src/core/rng';
import { withRotation } from '../src/generators/rotation';
import { GENERATORS } from '../src/generators/registry';
import { defineGenerator, type Generator } from '../src/generators/types';

const context = (width: number, height: number) => ({ width, height, random: mulberry32(3), seed: 3 });

/** Vertical stripes 4 cells wide: the value depends on x only. */
const verticalStripes = withRotation(
  defineGenerator({
    id: 'test-stripes',
    name: 'Test stripes',
    about: '',
    params: [],
    generate: (_params, { width, height }) => {
      const slots = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) slots[y * width + x] = Math.floor(x / 4) % 2;
      return slots;
    },
  }) as Generator,
);

const at = (slots: Uint8Array, width: number, x: number, y: number) => slots[y * width + x];

describe('pattern rotation', () => {
  it('every generator has a Rotation setting that defaults to 0', () => {
    for (const generator of GENERATORS) expect(defaultParams(generator.params).rotation).toBe(0);
  });

  it('at 0° the pattern is unchanged', () => {
    const unrotated = verticalStripes.generate({ rotation: 0 }, context(30, 20));
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 30; x++) expect(at(unrotated, 30, x, y)).toBe(Math.floor(x / 4) % 2);
  });

  it('at 90° vertical stripes become horizontal', () => {
    const turned = verticalStripes.generate({ rotation: 90 }, context(30, 20));
    for (let y = 0; y < 20; y++) for (let x = 1; x < 30; x++) expect(at(turned, 30, x, y)).toBe(at(turned, 30, 0, y));
    expect(new Set(Array.from({ length: 20 }, (_, y) => at(turned, 30, 0, y))).size).toBe(2);
  });

  it('at 45° stripes run diagonally, in steps', () => {
    const turned = verticalStripes.generate({ rotation: 45 }, context(30, 30));
    // Constant along one diagonal, changing along the other.
    for (let y = 1; y < 30; y++)
      for (let x = 0; x < 29; x++) expect(at(turned, 30, x + 1, y - 1)).toBe(at(turned, 30, x, y));
    expect(new Set(Array.from({ length: 30 }, (_, i) => at(turned, 30, i, i))).size).toBe(2);
  });

  it('rotated patterns of every generator are the right size and deterministic', () => {
    for (const generator of GENERATORS) {
      const params = { ...defaultParams(generator.params), rotation: 30 };
      const first = generator.generate(params, context(41, 23));
      expect(first).toHaveLength(41 * 23);
      expect(first).toEqual(generator.generate(params, context(41, 23)));
    }
  });
});
