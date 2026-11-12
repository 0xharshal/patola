/** Ready-made canvas sizes for a single pattern (wallpapers, screens, social posts, print). */
import type { Size } from '../layouts/types';

/** Paper at 300 dpi, portrait, in pixels. */
export const PAPER_300_DPI = {
  a4: { width: 2480, height: 3508 },
  a3: { width: 3508, height: 4961 },
  a2: { width: 4961, height: 7016 },
} as const satisfies Record<string, Size>;

export interface CanvasPreset extends Size {
  id: string;
  label: string;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'full-hd', label: 'Full HD', width: 1920, height: 1080 },
  { id: 'qhd', label: 'QHD', width: 2560, height: 1440 },
  { id: '4k', label: '4K UHD', width: 3840, height: 2160 },
  { id: '5k', label: '5K', width: 5120, height: 2880 },
  { id: '8k', label: '8K UHD', width: 7680, height: 4320 },
  { id: 'ultrawide', label: 'Ultrawide', width: 3440, height: 1440 },
  { id: 'phone', label: 'Phone wallpaper', width: 1290, height: 2796 },
  { id: 'tablet', label: 'Tablet wallpaper', width: 2048, height: 2732 },
  { id: 'square', label: 'Square', width: 2048, height: 2048 },
  { id: 'post', label: 'Social post, 4:5', width: 1080, height: 1350 },
  { id: 'banner', label: 'Banner, 3:1', width: 1500, height: 500 },
  { id: 'a4', label: 'A4, 300 dpi', ...PAPER_300_DPI.a4 },
  { id: 'a3', label: 'A3, 300 dpi', ...PAPER_300_DPI.a3 },
  { id: 'a2', label: 'A2, 300 dpi', ...PAPER_300_DPI.a2 },
];

/** The preset of this size, in either orientation (portrait or landscape). */
export function presetOf(size: Size): CanvasPreset | undefined {
  return CANVAS_PRESETS.find(
    (preset) =>
      (preset.width === size.width && preset.height === size.height) ||
      (preset.width === size.height && preset.height === size.width),
  );
}
