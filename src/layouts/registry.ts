import { BODY_ZONE, defineLayout, type LayoutDef } from './types';
import { saree, dupatta } from './saree';
import { rug } from './rug';
import { gharchola } from './gharchola';

/** One pattern filling the chosen size: the wallpaper / exploration mode. */
export const patternOnly = defineLayout({
  id: 'tile',
  name: 'Pattern only',
  about: 'One pattern filling the whole image. Best for exploring motifs and making wallpapers.',
  settings: [],
  body: { name: 'Pattern', about: '' },
  zones: [],
  warpHorizontal: false,
  size: (_settings, screenSize) => screenSize,
  regions: (_settings, size) => [{ zone: BODY_ZONE, x: 0, y: 0, ...size }],
});

export const LAYOUTS: LayoutDef[] = [patternOnly, saree, dupatta, gharchola, rug];

export const DEFAULT_LAYOUT_ID = patternOnly.id;

export function findLayout(id: string): LayoutDef | undefined {
  return LAYOUTS.find((layout) => layout.id === id);
}

export function getLayout(id: string): LayoutDef {
  return findLayout(id) ?? patternOnly;
}
