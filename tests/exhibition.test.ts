import { describe, expect, it } from 'vitest';
import { cameraAt, flight, gridInterest, planTour } from '../src/exhibition/tour';
import { EXHIBITION_SCHEMA, nextDesign } from '../src/exhibition/settings';
import { defaultDesign } from '../src/core/design';
import { defaultParams } from '../src/core/params';
import { mulberry32 } from '../src/core/rng';
import { designToQuery, parseUrl } from '../src/core/url';
import { MAX_SCALE } from '../src/render/camera';

const viewport = { width: 1920, height: 1080 };
const piece = { width: 3000, height: 1200 };

describe('exhibition camera flights', () => {
  const from = { centreX: 100, centreY: 100, scale: 0.5 };
  const to = { centreX: 2500, centreY: 900, scale: 20 };

  it('starts and ends at the given cameras', () => {
    const start = flight(from, to, viewport.width, 0);
    const end = flight(from, to, viewport.width, 1);
    for (const [actual, expected] of [
      [start, from],
      [end, to],
    ]) {
      expect(actual.centreX).toBeCloseTo(expected.centreX, 6);
      expect(actual.centreY).toBeCloseTo(expected.centreY, 6);
      expect(actual.scale).toBeCloseTo(expected.scale, 6);
    }
  });

  it('zooms out to travel far, then back in', () => {
    const near = { centreX: 0, centreY: 0, scale: 20 };
    const far = { centreX: 3000, centreY: 0, scale: 20 };
    expect(flight(near, far, viewport.width, 0.5).scale).toBeLessThan(5);
  });

  it('zooms in place geometrically', () => {
    const middle = flight({ centreX: 5, centreY: 5, scale: 1 }, { centreX: 5, centreY: 5, scale: 16 }, 1000, 0.5);
    expect(middle.scale).toBeCloseTo(4, 6);
    expect(middle.centreX).toBe(5);
  });
});

describe('exhibition tours', () => {
  const plan = (seed: number, closeups = true) =>
    planTour({ piece, viewport, pixelRatio: 2, closeups, random: mulberry32(seed) });

  it('starts and ends on the whole piece, and is the same for the same seed', () => {
    const stops = plan(4);
    expect(stops[0].at).toBe(0);
    expect(stops.at(-1)!.at).toBe(1);
    expect(stops[0].camera).toEqual(stops.at(-1)!.camera);
    expect(stops[0].camera.scale).toBeLessThan(1);
    expect(plan(4)).toEqual(stops);
  });

  it('zooms down to the threads only with close-ups on', () => {
    const closest = (closeups: boolean) => Math.max(...plan(9, closeups).map((stop) => stop.camera.scale));
    expect(closest(true)).toBeGreaterThanOrEqual(40);
    expect(closest(true)).toBeLessThanOrEqual(MAX_SCALE);
    expect(closest(false)).toBeLessThan(20);
  });

  it('keeps zoomed-in views on the piece', () => {
    for (const { camera } of plan(11)) {
      if (camera.scale * piece.width < viewport.width) continue;
      expect(camera.centreX - viewport.width / 2 / camera.scale).toBeGreaterThanOrEqual(-1e-9);
      expect(camera.centreX + viewport.width / 2 / camera.scale).toBeLessThanOrEqual(piece.width + 1e-9);
    }
  });

  it('moves continuously through the stops', () => {
    const stops = plan(2);
    let previous = cameraAt(stops, viewport.width, 0);
    for (let step = 1; step <= 1000; step++) {
      const camera = cameraAt(stops, viewport.width, step / 1000);
      expect(Math.abs(Math.log(camera.scale / previous.scale))).toBeLessThan(0.1);
      previous = camera;
    }
    const atStop = cameraAt(stops, viewport.width, stops[4].at);
    expect(atStop.scale).toBeCloseTo(stops[4].camera.scale, 6);
    expect(atStop.centreX).toBeCloseTo(stops[4].camera.centreX, 6);
  });

  it('prefers places with several colours for close-ups', () => {
    const slots = new Uint8Array(100 * 100);
    slots[50 * 100 + 50] = 1;
    slots[50 * 100 + 51] = 2;
    const interest = gridInterest({ width: 100, height: 100, slots }, 2);
    expect(interest(100, 100)).toBe(3);
    expect(interest(10, 10)).toBe(1);
  });
});

describe('exhibition designs', () => {
  it('keeps the design, or changes what the setting says, the same way for the same random', () => {
    const design = defaultDesign();
    const original = JSON.stringify(design);
    expect(nextDesign(design, 'none', mulberry32(1))).toEqual(design);
    const recoloured = nextDesign(design, 'colours', mulberry32(1));
    expect(recoloured.generator).toBe(design.generator);
    expect(recoloured.params).toEqual(design.params);
    expect(nextDesign(design, 'all', mulberry32(7))).toEqual(nextDesign(design, 'all', mulberry32(7)));
    expect(JSON.stringify(design)).toBe(original);
  });

  it('opens from a link with its settings', () => {
    const state = parseUrl('?view=exhibition&x.vary=colours&x.seconds=90&x.closeups=0&gen=phool');
    expect(state.view).toBe('exhibition');
    expect(state.exhibition).toEqual({ vary: 'colours', seconds: 90, closeups: false, captions: true });
    const again = parseUrl(`?${designToQuery(state.design, 'exhibition', state.exhibition)}`);
    expect(again.view).toBe('exhibition');
    expect(again.exhibition).toEqual(state.exhibition);
    expect(parseUrl('?x.vary=nonsense&x.seconds=1').exhibition).toEqual({
      ...defaultParams(EXHIBITION_SCHEMA),
      seconds: 15,
    });
  });
});
