/** Camera over the piece: which part is visible and how large. Pure functions. */
import type { Rect, Size } from '../layouts/types';
import type { View } from './renderer';

export interface Camera {
  /** Piece position (in threads) at the centre of the viewport. */
  centreX: number;
  centreY: number;
  /** Pixels per thread. */
  scale: number;
}

export type FitMode = 'contain' | 'cover';

export const MAX_SCALE = 48;

/** Camera showing `area` (in threads) inside the viewport, leaving `marginPx` around it. */
export function fitCamera(area: Rect, viewport: Size, mode: FitMode = 'contain', marginPx = 0): Camera {
  const availableWidth = Math.max(1, viewport.width - 2 * marginPx);
  const availableHeight = Math.max(1, viewport.height - 2 * marginPx);
  const scaleX = availableWidth / area.width;
  const scaleY = availableHeight / area.height;
  return {
    centreX: area.x + area.width / 2,
    centreY: area.y + area.height / 2,
    scale: Math.min(MAX_SCALE, mode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)),
  };
}

export function viewFor(camera: Camera, viewport: Size): View {
  return {
    width: viewport.width,
    height: viewport.height,
    originX: camera.centreX - viewport.width / 2 / camera.scale,
    originY: camera.centreY - viewport.height / 2 / camera.scale,
    scale: camera.scale,
  };
}

/** Zoom by `factor`, keeping the piece point under (pointX, pointY) in place. */
export function zoomAt(
  camera: Camera,
  viewport: Size,
  factor: number,
  pointX: number,
  pointY: number,
  minScale: number,
): Camera {
  const scale = Math.min(MAX_SCALE, Math.max(minScale, camera.scale * factor));
  const offsetX = pointX - viewport.width / 2;
  const offsetY = pointY - viewport.height / 2;
  // The piece point under the pointer must stay under the pointer.
  const pieceX = camera.centreX + offsetX / camera.scale;
  const pieceY = camera.centreY + offsetY / camera.scale;
  return { scale, centreX: pieceX - offsetX / scale, centreY: pieceY - offsetY / scale };
}

/** Move the view by a drag of (dragX, dragY) pixels, keeping the camera centre on the piece. */
export function panBy(camera: Camera, dragX: number, dragY: number, piece: Size): Camera {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  return {
    scale: camera.scale,
    centreX: clamp(camera.centreX - dragX / camera.scale, piece.width),
    centreY: clamp(camera.centreY - dragY / camera.scale, piece.height),
  };
}
