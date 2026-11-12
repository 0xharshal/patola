/** Export sizes: presets for the long side of the image, and estimates. */
import type { Size } from '../layouts/types';

export type SizePresetId = 'threads' | 'screen' | '4k' | 'a4' | 'a3' | 'a2' | 'custom';

export interface SizePreset {
  id: SizePresetId;
  label: string;
  /** Long side in pixels; 'screen' = this device's screen; null = thread size setting or custom. */
  longSide: number | 'screen' | null;
}

/** Paper sizes at 300 dpi (long side). */
export const SIZE_PRESETS: SizePreset[] = [
  { id: 'threads', label: 'At thread size', longSide: null },
  { id: 'screen', label: 'This screen', longSide: 'screen' },
  { id: '4k', label: '4K (3840 px)', longSide: 3840 },
  { id: 'a4', label: 'A4 print, 300 dpi', longSide: 3508 },
  { id: 'a3', label: 'A3 print, 300 dpi', longSide: 4961 },
  { id: 'a2', label: 'A2 print, 300 dpi', longSide: 7016 },
  { id: 'custom', label: 'Custom', longSide: null },
];

export const MAX_EXPORT_SIDE = 30_000;
/** Above this, a JPG may not fit in one browser canvas. */
export const MAX_JPEG_PIXELS = 16384 * 16384;

/** The preset's long side in pixels, or null when it depends on other settings. */
export function presetLongSide(preset: SizePreset): number | null {
  if (preset.longSide === 'screen')
    return Math.round(Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1));
  return preset.longSide;
}

/** Pixels per thread for an image whose long side is `longSide`. */
export function scaleForLongSide(pieceThreads: Size, longSide: number): number {
  return longSide / Math.max(pieceThreads.width, pieceThreads.height);
}

export function imageSize(pieceThreads: Size, pixelsPerThread: number): Size {
  return {
    width: Math.max(1, Math.round(pieceThreads.width * pixelsPerThread)),
    height: Math.max(1, Math.round(pieceThreads.height * pixelsPerThread)),
  };
}

export function formatMegapixels(size: Size): string {
  return `${((size.width * size.height) / 1e6).toFixed(1)} MP`;
}
