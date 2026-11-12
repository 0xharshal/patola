import { describe, expect, it } from 'vitest';
import { defaultParams, sanitizeParams } from '../src/core/params';
import { mulberry32 } from '../src/core/rng';
import { randomParams } from '../src/core/randomize';
import { GENERATORS } from '../src/generators/registry';
import { SLOT_COUNT } from '../src/palettes/presets';

const context = (width: number, height: number) => ({ width, height, random: mulberry32(7), seed: 7 });

describe('generators', () => {
  for (const generator of GENERATORS) {
    it(`${generator.id}: deterministic, right size, valid slots`, () => {
      const params = defaultParams(generator.params);
      const first = generator.generate(params, context(97, 61));
      expect(first).toHaveLength(97 * 61);
      expect(first).toEqual(generator.generate(params, context(97, 61)));
      expect(Math.max(...first)).toBeLessThan(SLOT_COUNT);
      if (!generator.userContent) expect(new Set(first).size).toBeGreaterThan(2); // a real pattern
    });

    it(`${generator.id}: random settings are valid and render`, () => {
      const random = mulberry32(1);
      for (let i = 0; i < 10; i++) {
        const params = randomParams(generator.params, random);
        expect(sanitizeParams(generator.params, params)).toEqual(params);
        expect(generator.generate(params, context(40, 12))).toHaveLength(480);
      }
    });
  }

  it('kinar runs along the longer side', () => {
    const kinar = GENERATORS.find((generator) => generator.id === 'kinar')!;
    const params = defaultParams(kinar.params);
    const horizontal = kinar.generate(params, context(60, 14));
    const vertical = kinar.generate(params, context(14, 60));
    // Transposing the vertical band gives the horizontal one.
    for (let y = 0; y < 14; y++) for (let x = 0; x < 60; x++) expect(vertical[x * 14 + y]).toBe(horizontal[y * 60 + x]);
  });
});
