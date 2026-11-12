/**
 * Render the whole piece at any size in tiles, then hand the pixels band by
 * band to an encoder: streaming PNG (any size) or a canvas for JPG.
 */
import { PatolaRenderer, type Frame } from '../render/renderer';
import type { Size } from '../layouts/types';
import { createPngWriter } from './png';

const TILE_WIDTH = 2048;
const BAND_HEIGHT = 512;

export interface ExportProgress {
  /** 0…1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Graphics card to ask for. */
  gpu?: WebGLPowerPreference;
}

/** What to draw; the exporter sets the view (and a background, which never shows). */
export type FrameWithoutView = Omit<Frame, 'view' | 'background'>;

/** Let the page repaint (progress bar) and notice cancellation between bands. */
async function yieldToBrowser(signal?: AbortSignal): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

/** Calls `onBand` with RGBA rows (top to bottom) for each horizontal band of the image. */
async function renderBands(
  frame: FrameWithoutView,
  size: Size,
  pixelsPerThread: number,
  onBand: (rgba: Uint8Array<ArrayBuffer>, top: number, rows: number) => Promise<void> | void,
  { onProgress, signal, gpu }: ExportProgress,
): Promise<void> {
  const canvas = document.createElement('canvas');
  const renderer = new PatolaRenderer(canvas, gpu);
  try {
    for (let top = 0; top < size.height; top += BAND_HEIGHT) {
      const rows = Math.min(BAND_HEIGHT, size.height - top);
      const band = new Uint8Array(size.width * rows * 4);
      for (let left = 0; left < size.width; left += TILE_WIDTH) {
        const columns = Math.min(TILE_WIDTH, size.width - left);
        renderer.draw({
          ...frame,
          background: '#000000',
          // One lamp over the whole image, so tiles join without seams.
          lightArea: { x: 0, y: 0, width: size.width / pixelsPerThread, height: size.height / pixelsPerThread },
          view: {
            width: columns,
            height: rows,
            originX: left / pixelsPerThread,
            originY: top / pixelsPerThread,
            scale: pixelsPerThread,
          },
        });
        const tile = renderer.readPixels();
        for (let row = 0; row < rows; row++) {
          band.set(tile.subarray(row * columns * 4, (row + 1) * columns * 4), (row * size.width + left) * 4);
        }
        // Yield after every tile so the page stays responsive (progress, Cancel) on slow GPUs.
        onProgress?.((top + (rows * (left + columns)) / size.width) / size.height);
        await yieldToBrowser(signal);
      }
      await onBand(band, top, rows);
    }
  } finally {
    renderer.dispose();
  }
}

export async function exportPng(
  frame: FrameWithoutView,
  size: Size,
  pixelsPerThread: number,
  progress: ExportProgress = {},
): Promise<Blob> {
  const writer = createPngWriter(size.width, size.height);
  try {
    await renderBands(frame, size, pixelsPerThread, (rgba, _top, rows) => writer.writeRows(rgba, rows), progress);
    return await writer.finish();
  } catch (problem) {
    writer.abort();
    throw problem;
  }
}

export async function exportJpeg(
  frame: FrameWithoutView,
  size: Size,
  pixelsPerThread: number,
  quality: number,
  progress: ExportProgress = {},
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This image is too large for a JPG in this browser. Try PNG instead.');
  await renderBands(
    frame,
    size,
    pixelsPerThread,
    (rgba, top, rows) => {
      context.putImageData(
        new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), size.width, rows),
        0,
        top,
      );
    },
    progress,
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  canvas.width = canvas.height = 0; // free the memory now
  if (!blob) throw new Error('This image is too large for a JPG in this browser. Try PNG instead.');
  return blob;
}
