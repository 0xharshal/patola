import { describe, expect, it } from 'vitest';
import { cameraAt, gridInterest, planImages, planTour, zoomMove } from '../src/exhibition/tour';
import type { Camera } from '../src/render/camera';
import { EXHIBITION_SCHEMA, nextDesign } from '../src/exhibition/settings';
import { applyLayout, defaultDesign } from '../src/core/design';
import { fabricCentre, fabricSpeed, panelDesign, panelsIn, panelSize } from '../src/exhibition/fabric';
import { defaultParams } from '../src/core/params';
import { mulberry32 } from '../src/core/rng';
import { designToQuery, parseUrl } from '../src/core/url';
import { MAX_SCALE } from '../src/render/camera';

const viewport = { width: 1920, height: 1080 };
const piece = { width: 3000, height: 1200 };

describe('exhibition camera moves', () => {
  const from = { centreX: 1500, centreY: 600, scale: 0.7 };
  const to = { centreX: 1300, centreY: 500, scale: 20 };

  it('starts and ends at the given cameras', () => {
    expect(zoomMove(from, to, 0)).toEqual(from);
    const end = zoomMove(from, to, 1);
    expect(end.scale).toBeCloseTo(to.scale, 9);
    expect(end.centreX).toBeCloseTo(to.centreX, 9);
    expect(end.centreY).toBeCloseTo(to.centreY, 9);
  });

  it('zooms at an even rate around one fixed point of the cloth', () => {
    expect(zoomMove({ ...from, scale: 1 }, { ...to, scale: 16 }, 0.5).scale).toBeCloseTo(4, 9);
    // The fixed point sits at the same place on screen in every frame.
    const screenOffset = (camera: typeof from, x: number) => (x - camera.centreX) * camera.scale;
    const fixedX = (to.centreX * to.scale - from.centreX * from.scale) / (to.scale - from.scale);
    for (const t of [0, 0.3, 0.7, 1])
      expect(screenOffset(zoomMove(from, to, t), fixedX)).toBeCloseTo(screenOffset(from, fixedX), 6);
  });

  it('pans evenly between views of the same size', () => {
    const middle = zoomMove({ centreX: 0, centreY: 0, scale: 5 }, { centreX: 100, centreY: 40, scale: 5 }, 0.25);
    expect(middle).toEqual({ centreX: 25, centreY: 10, scale: 5 });
  });
});

describe('exhibition tours', () => {
  const plan = (seed: number, closeups = true) =>
    planTour({ piece, viewport, pixelRatio: 2, closeups, seconds: 60, random: mulberry32(seed) });

  it('starts and ends on the widest view that fills the screen, the same for the same seed', () => {
    const stops = plan(4);
    expect(stops[0].at).toBe(0);
    expect(stops.at(-1)!.at).toBe(1);
    const cover = Math.max(viewport.width / piece.width, viewport.height / piece.height);
    expect(stops[0].camera.scale).toBeCloseTo(cover, 9);
    expect(stops.at(-1)!.camera.scale).toBeCloseTo(cover, 9);
    expect(plan(4)).toEqual(stops);
  });

  it('zooms down to the threads only with close-ups on', () => {
    const closest = (closeups: boolean) => Math.max(...plan(9, closeups).map((stop) => stop.camera.scale));
    expect(closest(true)).toBeGreaterThanOrEqual(35);
    expect(closest(true)).toBeLessThanOrEqual(MAX_SCALE);
    expect(closest(false)).toBeLessThan(20);
  });

  it('fills the screen with cloth in every frame, for long, tall and square pieces', () => {
    for (const shape of [
      piece,
      { width: 9000, height: 700 },
      { width: 500, height: 3000 },
      { width: 900, height: 900 },
    ]) {
      for (const seed of [1, 2, 3]) {
        const stops = planTour({
          piece: shape,
          viewport,
          pixelRatio: 1,
          closeups: true,
          seconds: 60,
          random: mulberry32(seed),
        });
        for (let step = 0; step <= 200; step++) {
          const camera = cameraAt(stops, shape, viewport, step / 200);
          const halfWidth = viewport.width / 2 / camera.scale;
          const halfHeight = viewport.height / 2 / camera.scale;
          expect(camera.centreX - halfWidth).toBeGreaterThanOrEqual(-1e-6);
          expect(camera.centreX + halfWidth).toBeLessThanOrEqual(shape.width + 1e-6);
          expect(camera.centreY - halfHeight).toBeGreaterThanOrEqual(-1e-6);
          expect(camera.centreY + halfHeight).toBeLessThanOrEqual(shape.height + 1e-6);
        }
      }
    }
  });

  it('moves calmly: slow screen motion, gentle zooms, no sudden changes, for short and long tours (30 fps)', () => {
    const screen = { width: 1920, height: 1080 };
    const fps = 30;
    const corners = [
      [0, 0],
      [screen.width, 0],
      [0, screen.height],
      [screen.width, screen.height],
    ];
    /** Screen widths per second the fastest screen corner moves over the cloth. */
    const cornerSpeed = (before: Camera, after: Camera) =>
      Math.max(
        ...corners.map(([x, y]) => {
          const pieceX = before.centreX + (x - screen.width / 2) / before.scale;
          const pieceY = before.centreY + (y - screen.height / 2) / before.scale;
          const movedX = (pieceX - after.centreX) * after.scale + screen.width / 2;
          const movedY = (pieceY - after.centreY) * after.scale + screen.height / 2;
          return (Math.hypot(movedX - x, movedY - y) * fps) / screen.width;
        }),
      );
    let fastest = 0;
    let fastestZoom = 0;
    let suddenest = 0;
    for (const shape of [piece, { width: 9000, height: 700 }, { width: 900, height: 900 }]) {
      for (const [seed, seconds] of [
        [1, 15],
        [2, 30],
        [3, 60],
        [4, 60],
        [5, 120],
        [6, 600],
      ]) {
        const stops = planTour({
          piece: shape,
          viewport: screen,
          pixelRatio: 1,
          closeups: true,
          seconds,
          random: mulberry32(seed),
        });
        let previous = cameraAt(stops, shape, screen, 0);
        let previousSpeed = 0;
        for (let frame = 1; frame <= seconds * fps; frame++) {
          const camera = cameraAt(stops, shape, screen, frame / (seconds * fps));
          const speed = cornerSpeed(previous, camera);
          fastest = Math.max(fastest, speed);
          fastestZoom = Math.max(fastestZoom, Math.abs(Math.log(camera.scale / previous.scale)) * fps);
          suddenest = Math.max(suddenest, Math.abs(speed - previousSpeed) * fps);
          [previous, previousSpeed] = [camera, speed];
        }
      }
    }
    // Measured: corners ≤ 0.33 screen widths/s, zoom ≤ 0.32 e-folds/s, speed changes ≤ 0.54 widths/s² (15 s tours).
    expect(fastest).toBeLessThan(0.35);
    expect(fastestZoom).toBeLessThan(0.35);
    expect(suddenest).toBeLessThan(0.6);
  });

  it('moves continuously through the stops', () => {
    const stops = plan(2);
    let previous = cameraAt(stops, piece, viewport, 0);
    for (let step = 1; step <= 1000; step++) {
      const camera = cameraAt(stops, piece, viewport, step / 1000);
      expect(Math.abs(Math.log(camera.scale / previous.scale))).toBeLessThan(0.1);
      previous = camera;
    }
    const atStop = cameraAt(stops, piece, viewport, stops[4].at);
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
    const state = parseUrl('?view=exhibition&x.style=fabric&x.vary=colours&x.seconds=90&x.closeups=0&gen=phool');
    expect(state.view).toBe('exhibition');
    expect(state.exhibition).toEqual({
      style: 'fabric',
      vary: 'colours',
      seconds: 90,
      closeups: false,
      captions: true,
    });
    const again = parseUrl(`?${designToQuery(state.design, 'exhibition', state.exhibition)}`);
    expect(again.view).toBe('exhibition');
    expect(again.exhibition).toEqual(state.exhibition);
    expect(parseUrl('?x.vary=nonsense&x.seconds=1').exhibition).toEqual({
      ...defaultParams(EXHIBITION_SCHEMA),
      seconds: 15,
    });
  });
});

describe('exhibition images', () => {
  it('cover the tour with images that hold every view, sharp and not too large', () => {
    const screen = { width: 1920, height: 1080 };
    for (const shape of [piece, { width: 9000, height: 700 }, { width: 900, height: 900 }]) {
      for (const seconds of [15, 60]) {
        const stops = planTour({
          piece: shape,
          viewport: screen,
          pixelRatio: 1,
          closeups: true,
          seconds,
          random: mulberry32(seconds),
        });
        const images = planImages(stops, shape, screen, seconds);
        expect(images[0].from).toBe(0);
        expect(images.at(-1)!.to).toBe(1);
        // Far fewer pictures to render than frames to draw.
        expect(images.length).toBeLessThan(seconds * 30 * 0.1);
        for (let frame = 0; frame <= seconds * 30; frame++) {
          const progress = frame / (seconds * 30);
          const image = images.find((candidate) => progress <= candidate.to)!;
          const camera = cameraAt(stops, shape, screen, progress);
          const halfWidth = screen.width / 2 / camera.scale;
          const halfHeight = screen.height / 2 / camera.scale;
          expect(camera.centreX - halfWidth).toBeGreaterThanOrEqual(image.area.x - 1e-6);
          expect(camera.centreX + halfWidth).toBeLessThanOrEqual(image.area.x + image.area.width + 1e-6);
          expect(camera.centreY - halfHeight).toBeGreaterThanOrEqual(image.area.y - 1e-6);
          expect(camera.centreY + halfHeight).toBeLessThanOrEqual(image.area.y + image.area.height + 1e-6);
          expect(camera.scale).toBeLessThanOrEqual(image.scale + 1e-9);
          expect(image.scale / camera.scale).toBeLessThanOrEqual(Math.SQRT2 * 1.03);
        }
        for (const image of images)
          expect(image.area.width * image.area.height * image.scale ** 2).toBeLessThanOrEqual(
            3.3 * screen.width * screen.height,
          );
      }
    }
  });
});

describe('endless fabric', () => {
  const screen = { width: 1920, height: 1080 };

  it('glides at a calm speed, turning smoothly, never stopping or jumping', () => {
    const speed = fabricSpeed(screen, 3);
    const fps = 30;
    let previous = fabricCentre(0, speed, 9);
    let previousVelocity = [0, 0];
    let fastest = 0;
    let suddenest = 0;
    const directions = new Set<string>();
    for (let frame = 1; frame <= 600 * fps; frame++) {
      const centre = fabricCentre(frame / fps, speed, 9);
      const velocity = [(centre[0] - previous[0]) * fps, (centre[1] - previous[1]) * fps];
      // Screen sizes per second, and its change per second.
      const screens = (Math.hypot(velocity[0], velocity[1]) * 3) / screen.height;
      fastest = Math.max(fastest, screens);
      if (frame > 1)
        suddenest = Math.max(
          suddenest,
          (Math.hypot(velocity[0] - previousVelocity[0], velocity[1] - previousVelocity[1]) * fps * 3) / screen.height,
        );
      if (frame > 10 * fps) expect(screens).toBeGreaterThan(0.03); // keeps moving once started
      if (screens > 0.049)
        directions.add(`${Math.sign(Math.round(velocity[0]))},${Math.sign(Math.round(velocity[1]))}`);
      [previous, previousVelocity] = [centre, velocity];
    }
    expect(fastest).toBeLessThanOrEqual(0.0501);
    expect(suddenest).toBeLessThan(0.02);
    expect(directions.size).toBe(4); // left, right, up and down
  });

  it('lays out panels of whole cells around any area, also at negative positions', () => {
    const panel = panelSize(screen, 3, 2);
    expect(panel % 2).toBe(0);
    expect(panel * 3).toBeCloseTo(screen.height, -1);
    const panels = panelsIn(-panel * 0.5, panel * 1.5, panel * 2, panel, panel);
    expect(panels).toEqual([
      [-1, 1],
      [0, 1],
      [1, 1],
      [-1, 2],
      [0, 2],
      [1, 2],
    ]);
  });

  it('gives every panel its own single-pattern design, the same each time', () => {
    const base = defaultDesign();
    applyLayout(base, 'saree');
    const first = panelDesign(base, 'all', 0, 0);
    expect(first.layout).toBe('tile');
    expect(first.generator).toBe(base.generator);
    const other = panelDesign(base, 'all', 3, -2);
    expect(other.layout).toBe('tile');
    expect(other).toEqual(panelDesign(base, 'all', 3, -2));
    expect(other).not.toEqual(panelDesign(base, 'all', -2, 3));
  });
});
