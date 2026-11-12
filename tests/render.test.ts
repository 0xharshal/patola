import { describe, expect, it } from 'vitest';
import { samplesPerAxis } from '../src/render/renderer';

describe('supersampling', () => {
  it('samples small threads 2 × 2, never flat cells', () => {
    expect(samplesPerAxis('realistic', 2)).toBe(2);
    expect(samplesPerAxis('realistic', 8)).toBe(1);
    expect(samplesPerAxis('flat', 2)).toBe(1);
  });
});
