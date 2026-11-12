import { describe, expect, it } from 'vitest';
import { fitCamera, panBy, viewFor, zoomAt } from '../src/render/camera';

const viewport = { width: 1000, height: 500 };

describe('camera', () => {
  it('fits a piece inside the viewport (contain) or fills it (cover)', () => {
    const area = { x: 0, y: 0, width: 4000, height: 1000 };
    expect(fitCamera(area, viewport, 'contain').scale).toBe(0.25);
    expect(fitCamera(area, viewport, 'cover').scale).toBe(0.5);
    const view = viewFor(fitCamera(area, viewport, 'contain'), viewport);
    expect(view.originX).toBe(0);
    expect(view.originY).toBe(-500); // letterboxed vertically
  });

  it('keeps the point under the pointer fixed while zooming', () => {
    const camera = { centreX: 500, centreY: 250, scale: 1 };
    const zoomed = zoomAt(camera, viewport, 2, 800, 100, 0.1);
    const before = viewFor(camera, viewport);
    const after = viewFor(zoomed, viewport);
    expect(after.originX + 800 / after.scale).toBeCloseTo(before.originX + 800 / before.scale);
    expect(after.originY + 100 / after.scale).toBeCloseTo(before.originY + 100 / before.scale);
  });

  it('does not pan the centre off the piece', () => {
    const moved = panBy({ centreX: 10, centreY: 10, scale: 1 }, 1000, 1000, { width: 100, height: 100 });
    expect([moved.centreX, moved.centreY]).toEqual([0, 0]);
  });
});
