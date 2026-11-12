import { describe, expect, it } from 'vitest';
import { CANVAS_PRESETS, PAPER_300_DPI, presetOf } from '../src/core/canvasSizes';
import { compose, maxCanvasSide } from '../src/core/compose';
import { defaultDesign, MAX_SIZE } from '../src/core/design';
import { parseUrl } from '../src/core/url';

describe('canvas sizes', () => {
  it('finds a preset in either orientation', () => {
    expect(presetOf({ width: 3840, height: 2160 })?.id).toBe('4k');
    expect(presetOf({ width: 2160, height: 3840 })?.id).toBe('4k');
    expect(presetOf({ width: 1000, height: 1001 })).toBeUndefined();
    expect(presetOf(PAPER_300_DPI.a4)?.id).toBe('a4');
  });

  it('has presets within the size limit, each a distinct size', () => {
    for (const preset of CANVAS_PRESETS) expect(Math.max(preset.width, preset.height)).toBeLessThanOrEqual(MAX_SIZE);
    const sizes = CANVAS_PRESETS.map(({ width, height }) => `${Math.min(width, height)}x${Math.max(width, height)}`);
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('allows large canvases in links, and makes them at the default thread size', () => {
    const { design } = parseUrl('?w=7680&h=4320');
    expect(design.size).toEqual({ width: 7680, height: 4320 });
    // The app composes at the canvas size (the screen when there is none).
    const { grid } = compose(design, design.size!);
    expect(grid.width * 3 * 2).toBeGreaterThanOrEqual(7680); // thread 3 px, 2 threads per cell
  });

  it('says how large a canvas can be at a thread size', () => {
    const design = defaultDesign();
    expect(maxCanvasSide(design.render)).toBe(MAX_SIZE); // 3 px threads, 2 per cell: 24,576 > 16,384
    expect(maxCanvasSide({ ...design.render, threadPx: 1, step: 1 })).toBe(4096);
  });
});
