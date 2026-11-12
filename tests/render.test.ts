import { describe, expect, it } from 'vitest';
import { lampPosition, samplesPerAxis } from '../src/render/renderer';
import { FRAGMENT_SHADER, IMAGE_FRAGMENT_SHADER } from '../src/render/shaders';

describe('supersampling', () => {
  it('samples small threads 2 × 2, never flat cells', () => {
    expect(samplesPerAxis('realistic', 2)).toBe(2);
    expect(samplesPerAxis('realistic', 8)).toBe(1);
    expect(samplesPerAxis('flat', 2)).toBe(1);
  });
});

describe('lamp', () => {
  it('hangs on the side the light comes from, as high as the area is large', () => {
    const area = { x: 0, y: 0, width: 100, height: 50 };
    const [fromTopX, fromTopY, height] = lampPosition(area, 0);
    expect(fromTopX).toBeCloseTo(50);
    expect(fromTopY).toBeLessThan(0);
    expect(height).toBe(70);
    const [fromRightX, fromRightY] = lampPosition(area, 90);
    expect(fromRightX).toBeGreaterThan(100);
    expect(fromRightY).toBeCloseTo(25);
  });
});

describe('shaders', () => {
  it('share one sRGB conversion', () => {
    for (const shader of [FRAGMENT_SHADER, IMAGE_FRAGMENT_SHADER])
      expect(shader.match(/vec3 linearToSrgb\(/g)).toHaveLength(1);
  });
});
