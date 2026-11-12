import { describe, expect, it } from 'vitest';
import { cameraAt, gridInterest, planImages, planTour, zoomMove } from '../src/exhibition/tour';
import type { Camera } from '../src/render/camera';
import { EXHIBITION_SCHEMA, nextDesign } from '../src/exhibition/settings';
import { applyLayout, defaultDesign } from '../src/core/design';
import { FabricPath, fabricCentre, fabricMotion, panelDesign, panelsIn } from '../src/exhibition/fabric';
import { FramePacer, PreparationBudget } from '../src/exhibition/pacing';
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
      speed: 0.05,
      hold: 5,
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
  const scale = 3;
  const motion = fabricMotion(screen, scale, 2, 0.05, 5);
  const fps = 30;
  /** Camera centres for `seconds` at 30 fps. */
  const path = (seconds: number, seed = 9) =>
    Array.from({ length: seconds * fps + 1 }, (_, frame) => fabricCentre(frame / fps, motion, seed));

  it('glides at one calm speed, turning on gentle curves, left, right, up and down', () => {
    const centres = path(1200);
    let suddenest = 0;
    const directions = new Set<string>();
    for (let frame = 2; frame < centres.length; frame++) {
      const [[x0, y0], [x1, y1], [x2, y2]] = centres.slice(frame - 2, frame + 1);
      const velocity = [(x2 - x1) * fps, (y2 - y1) * fps];
      // Constant speed, in screen sizes per second.
      expect((Math.hypot(velocity[0], velocity[1]) * scale) / screen.height).toBeCloseTo(0.05, 4);
      const acceleration = Math.hypot(x2 - 2 * x1 + x0, y2 - 2 * y1 + y0) * fps * fps;
      suddenest = Math.max(suddenest, (acceleration * scale) / screen.height);
      directions.add(`${Math.round(velocity[0] / motion.speed)},${Math.round(velocity[1] / motion.speed)}`);
    }
    expect(suddenest).toBeLessThan(0.02); // screen sizes per second², only while curving
    // Straight runs in all four directions (diagonals only appear mid-curve).
    const straight = [...directions].filter(
      (direction) => direction.split(',').filter((part) => part !== '0').length === 1,
    );
    expect(straight).toHaveLength(4);
  });

  it('lets every design it passes fill the whole screen for the chosen time', () => {
    // [speed, seconds asked, seconds expected]: at 0.12 screens a second, 20 s would need more
    // than the one extra screen of cloth a panel may have, so it gets what that allows.
    for (const [speed, hold, expected] of [
      [0.05, 5, 5],
      [0.05, 12, 12],
      [0.02, 20, 20],
      [0.12, 3, 3],
      [0.12, 20, 1 / 0.12],
    ]) {
      const held = fabricMotion(screen, scale, 2, speed, hold);
      for (const seed of [1, 2, 3]) {
        // Seconds each panel fills the screen without a break, per visit.
        const visits: { panel: string; seconds: number }[] = [];
        const path = new FabricPath(held, seed);
        for (let frame = 0; frame <= 300 * fps; frame++) {
          const [x, y] = path.centreAt(frame / fps);
          const [halfWidth, halfHeight] = [screen.width / 2 / scale, screen.height / 2 / scale];
          const shown = panelsIn(x - halfWidth, y - halfHeight, 2 * halfWidth, 2 * halfHeight, held.panel);
          const last = visits.at(-1);
          if (shown.length === 1 && last?.panel === String(shown[0])) last.seconds += 1 / fps;
          else if (shown.length === 1) visits.push({ panel: String(shown[0]), seconds: 0 });
          else if (last && last.panel !== '') visits.push({ panel: '', seconds: 0 });
        }
        const designVisits = visits.filter((visit) => visit.panel !== '');
        // The last visit may be cut off by the end of the run.
        for (const visit of designVisits.slice(0, -1)) expect(visit.seconds).toBeGreaterThanOrEqual(expected - 0.1);
        expect(designVisits.length).toBeGreaterThan(2);
      }
    }
  });

  it('uses panels a little larger than the screen, of whole cells', () => {
    expect(motion.panel.width % 2).toBe(0);
    expect(motion.panel.height % 2).toBe(0);
    expect(motion.panel.width * scale).toBeGreaterThan(screen.width);
    expect(motion.panel.height * scale).toBeGreaterThan(screen.height);
    expect(motion.panel.height * scale).toBeLessThan(screen.height * 1.5);
    const panels = panelsIn(
      -motion.panel.width / 2,
      motion.panel.height * 1.5,
      motion.panel.width * 2,
      10,
      motion.panel,
    );
    expect(panels).toEqual([
      [-1, 1],
      [0, 1],
      [1, 1],
    ]);
  });

  it('gives every panel its own single-pattern design, the same each time', () => {
    const base = defaultDesign();
    applyLayout(base, 'saree');
    const first = panelDesign(base, 'all', 0, 0, 7);
    expect(first.layout).toBe('tile');
    expect(first.generator).toBe(base.generator);
    const other = panelDesign(base, 'all', 3, -2, 7);
    expect(other.layout).toBe('tile');
    expect(other).toEqual(panelDesign(base, 'all', 3, -2, 7));
    expect(other).not.toEqual(panelDesign(base, 'all', -2, 3, 7));
    // Another exhibition (seed) gives the panel another design.
    expect(other).not.toEqual(panelDesign(base, 'all', 3, -2, 8));
  });
});

describe('fabric path', () => {
  it('gives the same centres whether asked in order, out of order or afresh', () => {
    const motion = fabricMotion({ width: 1920, height: 1080 }, 3, 2, 0.05, 5);
    const path = new FabricPath(motion, 4);
    const late = path.centreAt(3000);
    expect(path.centreAt(12)).toEqual(new FabricPath(motion, 4).centreAt(12)); // back in time
    expect(late).toEqual(new FabricPath(motion, 4).centreAt(3000));
    expect(fabricCentre(777, motion, 4)).toEqual(path.centreAt(777));
  });
});

describe('frame pacing', () => {
  /** Draws per second over 10 s on a display refreshing `hertz` times a second, with timestamp jitter. */
  const drawsPerSecond = (target: number, hertz: number) => {
    const pacer = new FramePacer(target);
    const random = mulberry32(hertz);
    let draws = 0;
    for (let frame = 0; frame < hertz * 10; frame++)
      if (pacer.shouldDraw((frame * 1000) / hertz + (random() - 0.5) * 0.8)) draws++;
    return draws / 10;
  };

  it('draws at the chosen rate on 60, 120, 144 and 165 Hz displays, or at the display rate when slower', () => {
    for (const hertz of [60, 120, 144, 165])
      for (const target of [30, 60, 120])
        expect(drawsPerSecond(target, hertz)).toBeCloseTo(Math.min(target, hertz), -0.5);
  });

  it('draws on every refresh when matching the display', () => {
    expect(drawsPerSecond(Infinity, 165)).toBe(165);
  });
});

describe('fabric speed', () => {
  it('keeps each design on the full screen for 5 seconds at any speed, with larger panels when faster', () => {
    const screen = { width: 1920, height: 1080 };
    const slow = fabricMotion(screen, 3, 2, 0.01, 5);
    const fast = fabricMotion(screen, 3, 2, 0.12, 5);
    expect(fast.speed / slow.speed).toBeCloseTo(12, 6);
    expect(fast.panel.height).toBeGreaterThan(slow.panel.height);
    // The margin around the screen leaves room for 5 s of gliding.
    expect((fast.panel.height - screen.height / 3) / fast.speed).toBeGreaterThanOrEqual(5);
  });
});

describe('preparation budget', () => {
  it('gives the same work per second at 30 and 165 frames per second', () => {
    const perSecond = (fps: number) => {
      const budget = new PreparationBudget(18_000_000);
      let pixels = 0;
      for (let frame = 1; frame <= fps; frame++) pixels += budget.forFrame((frame * 1000) / fps);
      return pixels;
    };
    expect(perSecond(165) / perSecond(30)).toBeCloseTo(1, 1);
  });
});
