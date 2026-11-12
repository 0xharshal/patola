import { ZARI_SLOT } from '../generators/types';

/**
 * Palettes are ordered colour slots. Designs store slot indices, never raw colours,
 * so swapping a palette recolours everything instantly.
 */
export const SLOT_NAMES = ['Ground', 'Primary', 'Secondary', 'Accent', 'Outline'] as const;
export const SLOT_COUNT = SLOT_NAMES.length;

/** Gold zari thread: a fixed metallic colour, not part of any palette. */
export const ZARI_COLOUR = '#c9a24a';

/** Colour of a design slot: the palette colour, or gold for zari. */
export function slotColour(palette: readonly string[], slot: number): string {
  return slot === ZARI_SLOT ? ZARI_COLOUR : (palette[slot] ?? palette[0]);
}

export interface PalettePreset {
  id: string;
  name: string;
  colors: string[]; // '#rrggbb', one per slot
}

export const PALETTES: PalettePreset[] = [
  { id: 'madder-indigo', name: 'Madder & indigo', colors: ['#8f1d21', '#1f2f5c', '#e8c547', '#f3ead8', '#151515'] },
  { id: 'turmeric-black', name: 'Turmeric & black', colors: ['#d99a1b', '#1a1a1a', '#a31f1f', '#f4ecd6', '#2c5e3a'] },
  { id: 'parrot-green', name: 'Parrot green', colors: ['#2f7d3a', '#b3202a', '#f2d04a', '#f5efe0', '#1b1b1b'] },
  { id: 'ivory-maroon', name: 'Ivory & maroon', colors: ['#efe3c8', '#6e1423', '#1d3557', '#d9a441', '#2b2b2b'] },
  { id: 'jewel', name: 'Jewel tones', colors: ['#4e1660', '#0f6b5c', '#d4a017', '#f7f1e3', '#13132b'] },
  { id: 'vintage', name: 'Faded vintage', colors: ['#a8573f', '#3d4f63', '#c9a66b', '#ede0c8', '#2e2a26'] },
  { id: 'pomegranate', name: 'Pomegranate', colors: ['#b0263a', '#f0c9a0', '#3a6b4f', '#f6e7c1', '#2a0f14'] },
  { id: 'saffron-purple', name: 'Saffron & purple', colors: ['#e07a1f', '#4b1d5c', '#2e6e8e', '#f8e6b8', '#1c1020'] },
  { id: 'indigo-ivory', name: 'Indigo & ivory', colors: ['#1d2b55', '#efe4cc', '#a82a2a', '#d9b44a', '#0b0f1f'] },
  { id: 'teal-coral', name: 'Teal & coral', colors: ['#0f5c5c', '#e2725b', '#e9c46a', '#f4ede1', '#102020'] },
  { id: 'mono', name: 'Monochrome', colors: ['#efe9df', '#2a2a2a', '#7a7a7a', '#bdb6aa', '#000000'] },
];

export const DEFAULT_PALETTE_ID = PALETTES[0].id;

export function getPalette(id: string): PalettePreset | undefined {
  return PALETTES.find((palette) => palette.id === id);
}

const HEX = /^#?([0-9a-f]{6})$/i;

/** Normalise '#ABCDEF' / 'abcdef' to '#abcdef', or null if invalid. */
export function normalizeHex(value: string): string | null {
  const match = HEX.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

/** Parse 'aa0000,00ff00,…' into exactly SLOT_COUNT colours, or null if unusable. */
export function parseHexList(value: string): string[] | null {
  const parts = value.split(',').map(normalizeHex);
  const colors = parts.filter((part): part is string => part !== null);
  if (colors.length === 0 || colors.length !== parts.length) return null;
  // Too few colours: repeat what was given; too many: ignore the extra.
  return Array.from({ length: SLOT_COUNT }, (_, slot) => colors[slot % colors.length]);
}

export function hexToRgb(hex: string): [number, number, number] {
  const packed = parseInt(hex.slice(1), 16);
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}
