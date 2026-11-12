/**
 * Camera tours for the exhibition: a few planned stops over a piece (whole
 * piece, motifs, close-ups of the threads) and smooth flights between them.
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
  random: Rng;
  /** How much there is to see around a piece point (higher is better); picks where to zoom in. */
  interest?: (x: number, y: number) => number;
}

/** Threads at motif level and at thread level, in CSS pixels per thread. */
const MOTIF_SCALE = 5;
const THREAD_SCALE = 22;
/** Random points tried per stop when an `interest` function is given. */
const CANDIDATES = 8;

/** Keep the view on the piece: centred when it fits, otherwise inside it. */
function clampToPiece(camera: Camera, piece: Size, viewport: Size): Camera {
  const clampAxis = (centre: number, length: number, viewLength: number) => {
    const half = viewLength / 2 / camera.scale;
    return length <= 2 * half ? length / 2 : Math.min(length - half, Math.max(half, centre));
  };
  return {
    scale: camera.scale,
    centreX: clampAxis(camera.centreX, piece.width, viewport.width),
    centreY: clampAxis(camera.centreY, piece.height, viewport.height),
  };
}

export function planTour({ piece, viewport, pixelRatio, closeups, random, interest }: TourOptions): TourStop[] {
  const overview = fitCamera(
    { x: 0, y: 0, ...piece },
    viewport,
    'contain',
    Math.min(viewport.width, viewport.height) * 0.04,
  );
  const motifScale = Math.min(MAX_SCALE, Math.max(overview.scale * 1.6, MOTIF_SCALE * pixelRatio));
  const threadScale = Math.min(MAX_SCALE, Math.max(motifScale * 1.5, THREAD_SCALE * pixelRatio));

  const pickPoint = (): [number, number] => {
    let best: [number, number] = [random() * piece.width, random() * piece.height];
    if (!interest) return best;
    let bestScore = interest(...best);
    for (let attempt = 1; attempt < CANDIDATES; attempt++) {
      const candidate: [number, number] = [random() * piece.width, random() * piece.height];
      const score = interest(...candidate);
      if (score > bestScore) [best, bestScore] = [candidate, score];
    }
    return best;
  };
  /** A view of `scale` around an interesting point, and a slow drift away from it. */
  const shotAndDrift = (scale: number, driftViewports: number): [Camera, Camera] => {
    const [x, y] = pickPoint();
    const start = clampToPiece({ centreX: x, centreY: y, scale }, piece, viewport);
    const angle = random() * 2 * Math.PI;
    const distance = (driftViewports * Math.min(viewport.width, viewport.height)) / scale;
    const end = clampToPiece(
      {
        centreX: start.centreX + Math.cos(angle) * distance,
        centreY: start.centreY + Math.sin(angle) * distance,
        scale: scale * 1.08,
      },
      piece,
      viewport,
    );
    return [start, end];
  };

  const settled = { ...overview, scale: overview.scale * 1.06 };
  const [motif, motifDrift] = shotAndDrift(motifScale, 0.35);
  const [detail, detailDrift] = closeups ? shotAndDrift(threadScale, 0.25) : shotAndDrift(motifScale * 1.3, 0.35);
  return [
    { at: 0, camera: overview },
    { at: 0.14, camera: settled },
    { at: 0.28, camera: motif },
    { at: 0.46, camera: motifDrift },
    { at: 0.6, camera: detail },
    { at: 0.8, camera: detailDrift },
    { at: 1, camera: overview },
  ];
}

/** Ease in and out (smootherstep), so the camera settles at every stop. */
function ease(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** How strongly a flight zooms out to travel (van Wijk & Nuij's ρ; √2 is their recommended value). */
const RHO = Math.SQRT2;

/**
 * Smooth zoom-and-pan from `from` to `to` (van Wijk & Nuij, "Smooth and efficient
 * zooming and panning", 2003): far moves zoom out, travel, and zoom back in, so
 * the speed on screen stays even. `t` runs from 0 to 1.
 */
export function flight(from: Camera, to: Camera, viewportWidth: number, t: number): Camera {
  // Work in "visible width in threads", where the zoom path has a closed form.
  const startWidth = viewportWidth / from.scale;
  const endWidth = viewportWidth / to.scale;
  const deltaX = to.centreX - from.centreX;
  const deltaY = to.centreY - from.centreY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance < 1e-6 * startWidth) {
    // Pure zoom (and the odd tiny shift): interpolate the scale geometrically.
    const width = startWidth * (endWidth / startWidth) ** t;
    return {
      centreX: from.centreX + deltaX * t,
      centreY: from.centreY + deltaY * t,
      scale: viewportWidth / width,
    };
  }

  const rho2 = RHO * RHO;
  const startB =
    (endWidth * endWidth - startWidth * startWidth + rho2 * rho2 * distance * distance) /
    (2 * startWidth * rho2 * distance);
  const endB =
    (endWidth * endWidth - startWidth * startWidth - rho2 * rho2 * distance * distance) /
    (2 * endWidth * rho2 * distance);
  const startR = Math.log(Math.sqrt(startB * startB + 1) - startB);
  const endR = Math.log(Math.sqrt(endB * endB + 1) - endB);
  const length = (endR - startR) / RHO;
  const s = t * length;
  const coshStart = Math.cosh(startR);
  const travelled = (startWidth / rho2) * (coshStart * Math.tanh(RHO * s + startR) - Math.sinh(startR));
  const width = (startWidth * coshStart) / Math.cosh(RHO * s + startR);
  return {
    centreX: from.centreX + (deltaX / distance) * travelled,
    centreY: from.centreY + (deltaY / distance) * travelled,
    scale: viewportWidth / width,
  };
}

/** The camera at `progress` (0…1) through a tour. */
export function cameraAt(stops: TourStop[], viewportWidth: number, progress: number): Camera {
  const time = Math.min(1, Math.max(0, progress));
  const next = stops.findIndex((stop) => stop.at >= time);
  if (next <= 0) return stops[0].camera;
  const previous = stops[next - 1];
  const local = (time - previous.at) / (stops[next].at - previous.at);
  return flight(previous.camera, stops[next].camera, viewportWidth, ease(local));
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
