/**
 * Camera tours for the exhibition: a few planned stops over a piece (its widest
 * view, motifs, close-ups of the threads) and smooth, slow moves between them.
 * The cloth always fills the screen: no bars beside it.
 * Pure functions, so the same plan gives the same moves.
 */
import { fitCamera, MAX_SCALE, type Camera } from '../render/camera';
import type { Size } from '../layouts/types';
import type { Rng } from '../core/rng';
import type { Grid } from '../core/compose';

/** A camera to reach at a moment of the tour (0 = start, 1 = end). */
export interface TourStop {
  at: number;
  camera: Camera;
}

export interface TourOptions {
  /** Piece size in threads. */
  piece: Size;
  /** Viewport in device pixels. */
  viewport: Size;
  /** Device pixels per CSS pixel: close-ups are sized for the eye, not the pixel count. */
  pixelRatio: number;
  closeups: boolean;
  /** Length of the tour: shorter tours zoom less deep and drift less, so they move no faster. */
  seconds: number;
  random: Rng;
  /** How much there is to see around a piece point (higher is better); picks where to zoom in. */
  interest?: (x: number, y: number) => number;
}

/** Threads at motif level and at thread level, in CSS pixels per thread. */
const MOTIF_SCALE = 5;
const THREAD_SCALE = 22;
/** Random points tried per stop when an `interest` function is given. */
const CANDIDATES = 8;

/**
 * The nearest camera whose view lies entirely on the piece, so the cloth fills
 * the screen: zoomed in at least far enough to cover it, and moved inside.
 */
export function fillView(camera: Camera, piece: Size, viewport: Size): Camera {
  const scale = Math.max(camera.scale, viewport.width / piece.width, viewport.height / piece.height);
  const clampAxis = (centre: number, length: number, viewLength: number) => {
    const half = viewLength / 2 / scale;
    return Math.min(length - half, Math.max(half, centre));
  };
  return {
    scale,
    centreX: clampAxis(camera.centreX, piece.width, viewport.width),
    centreY: clampAxis(camera.centreY, piece.height, viewport.height),
  };
}

/** Slow drifts, in screen sizes (the shorter side) per stop. */
const OPENING_DRIFT = 0.6;
const MOTIF_DRIFT = 0.35;
const DETAIL_DRIFT = 0.25;
/** Shares of the tour for the opening, motif and detail drifts; the zooms share the rest. */
const DRIFT_SHARES = [0.12, 0.14, 0.16];
/** Added to every zoom's extent (in e-folds) so even small zooms get a little time. */
const ZOOM_BASE = 0.3;
/** Mean zoom speed to plan for, in e-folds per second (easing peaks at 1.5× this). */
const ZOOM_RATE = 0.25;
/** Tours this long or longer drift the full distances above. */
const FULL_DRIFT_SECONDS = 60;
/** Share of the view, around its centre, where the next closer shot is picked. */
const NEXT_SHOT_AREA = 0.6;

/**
 * Plan a calm tour. Every closer shot lies inside the view before it, so the
 * camera mostly zooms straight in or out with slow drifts, never racing across
 * the cloth (fast sideways motion on a large screen is nauseating).
 */
export function planTour({
  piece,
  viewport,
  pixelRatio,
  closeups,
  seconds,
  random,
  interest,
}: TourOptions): TourStop[] {
  const widest = fillView(fitCamera({ x: 0, y: 0, ...piece }, viewport, 'cover'), piece, viewport);
  let motifScale = Math.min(MAX_SCALE, Math.max(widest.scale * 1.6, MOTIF_SCALE * pixelRatio));
  let detailScale = closeups
    ? Math.min(MAX_SCALE, Math.max(motifScale * 1.5, THREAD_SCALE * pixelRatio))
    : motifScale * 1.3;
  // Zooming in and back out covers the depth twice: keep the mean zoom speed at ZOOM_RATE.
  const zoomSeconds = (1 - DRIFT_SHARES.reduce((sum, share) => sum + share)) * seconds;
  const deepest = Math.max(0.4, (ZOOM_RATE * zoomSeconds - 3 * ZOOM_BASE) / 2);
  if (Math.log(detailScale / widest.scale) > deepest) {
    detailScale = widest.scale * Math.exp(deepest);
    motifScale = Math.min(motifScale, widest.scale * Math.exp(deepest / 2));
  }
  const driftScale = Math.min(1, seconds / FULL_DRIFT_SECONDS);
  const screen = Math.min(viewport.width, viewport.height);

  /** A slow drift of `screens` screen sizes in direction `angle`, zooming in a little. */
  const drift = (from: Camera, screens: number, angle: number): Camera =>
    fillView(
      {
        centreX: from.centreX + (Math.cos(angle) * screens * driftScale * screen) / from.scale,
        centreY: from.centreY + (Math.sin(angle) * screens * driftScale * screen) / from.scale,
        scale: from.scale * 1.06,
      },
      piece,
      viewport,
    );

  /** The most interesting of a few points in the middle of what `view` shows, seen at `scale`. */
  const closerShot = (view: Camera, scale: number): Camera => {
    const pick = (): [number, number] => [
      view.centreX + ((random() - 0.5) * NEXT_SHOT_AREA * viewport.width) / view.scale,
      view.centreY + ((random() - 0.5) * NEXT_SHOT_AREA * viewport.height) / view.scale,
    ];
    let best = pick();
    if (interest) {
      let bestScore = interest(...best);
      for (let attempt = 1; attempt < CANDIDATES; attempt++) {
        const candidate = pick();
        const score = interest(...candidate);
        if (score > bestScore) [best, bestScore] = [candidate, score];
      }
    }
    return fillView({ centreX: best[0], centreY: best[1], scale }, piece, viewport);
  };

  // Open on the widest view somewhere along the piece, drifting along its length.
  const along = piece.width >= piece.height ? 0 : Math.PI / 2;
  const direction = random() < 0.5 ? 0 : Math.PI;
  const opening = fillView(
    { ...widest, centreX: random() * piece.width, centreY: random() * piece.height },
    piece,
    viewport,
  );
  const settled = drift(opening, OPENING_DRIFT, along + direction);
  const motif = closerShot(settled, motifScale);
  const motifDrift = drift(motif, MOTIF_DRIFT, random() * 2 * Math.PI);
  const detail = closerShot(motifDrift, detailScale);
  const detailDrift = drift(detail, DETAIL_DRIFT, random() * 2 * Math.PI);
  // Back out to the widest view over the same place: a straight zoom, no sideways rush.
  const closing = fillView({ ...widest, centreX: detailDrift.centreX, centreY: detailDrift.centreY }, piece, viewport);
  // Drifts get fixed shares of the time; zooms share the rest by how far they zoom, so all run at one calm rate.
  const zoomExtent = (from: Camera, to: Camera) => ZOOM_BASE + Math.abs(Math.log(to.scale / from.scale));
  const zooms = [zoomExtent(settled, motif), zoomExtent(motifDrift, detail), zoomExtent(detailDrift, closing)];
  const zoomShare = (index: number) =>
    ((1 - DRIFT_SHARES.reduce((sum, share) => sum + share)) * zooms[index]) / (zooms[0] + zooms[1] + zooms[2]);
  const moves: [Camera, number][] = [
    [settled, DRIFT_SHARES[0]],
    [motif, zoomShare(0)],
    [motifDrift, DRIFT_SHARES[1]],
    [detail, zoomShare(1)],
    [detailDrift, DRIFT_SHARES[2]],
    [closing, zoomShare(2)],
  ];
  const stops: TourStop[] = [{ at: 0, camera: opening }];
  for (const [camera, share] of moves) stops.push({ at: stops.at(-1)!.at + share, camera });
  stops[stops.length - 1].at = 1; // exactly, despite rounding
  return stops;
}

/** Ease in and out (smoothstep), so the camera settles at every stop; peaks at 1.5× the mean speed. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Move from `from` to `to` (`t` from 0 to 1) as a zoom around one fixed point of
 * the cloth: the visible width changes geometrically (even zoom speed) and the
 * view's edges move in step with it. Every view on the way is a blend of the two
 * end views, so when both lie on the cloth, all of them do. Same widths: a
 * straight, even pan.
 */
export function zoomMove(from: Camera, to: Camera, t: number): Camera {
  const ratio = from.scale / to.scale; // end width / start width
  const scale = from.scale * (to.scale / from.scale) ** t;
  const progress = Math.abs(Math.log(ratio)) < 1e-9 ? t : (1 - from.scale / scale) / (1 - ratio);
  return {
    scale,
    centreX: from.centreX + (to.centreX - from.centreX) * progress,
    centreY: from.centreY + (to.centreY - from.centreY) * progress,
  };
}

/** The camera at `progress` (0…1) through a tour; the cloth always fills the screen. */
export function cameraAt(stops: TourStop[], piece: Size, viewport: Size, progress: number): Camera {
  const time = Math.min(1, Math.max(0, progress));
  const next = stops.findIndex((stop) => stop.at >= time);
  if (next <= 0) return stops[0].camera;
  const previous = stops[next - 1];
  const local = (time - previous.at) / (stops[next].at - previous.at);
  // Both stops fill the screen, so every blend does; fillView only guards against rounding.
  return fillView(zoomMove(previous.camera, stops[next].camera, ease(local)), piece, viewport);
}

/** Window around a point, in design cells, that `gridInterest` looks at. */
const INTEREST_RADIUS = 4;

/**
 * Interest of a point for close-ups: how many different colours are near it, so
 * the camera zooms into motifs and edges rather than plain ground.
 */
export function gridInterest(grid: Grid, threadsPerCell: number): (x: number, y: number) => number {
  return (x, y) => {
    const centreX = Math.floor(x / threadsPerCell);
    const centreY = Math.floor(y / threadsPerCell);
    let seen = 0;
    for (let row = centreY - INTEREST_RADIUS; row <= centreY + INTEREST_RADIUS; row++) {
      for (let column = centreX - INTEREST_RADIUS; column <= centreX + INTEREST_RADIUS; column++) {
        if (row < 0 || column < 0 || row >= grid.height || column >= grid.width) continue;
        seen |= 1 << grid.slots[row * grid.width + column];
      }
    }
    let colours = 0;
    for (; seen; seen &= seen - 1) colours++;
    return colours;
  };
}
