import { newId, readStoredList, writeStoredList } from '../custom/storage';
import { normalizeHex, SLOT_COUNT } from './presets';

/** User palettes, kept in this browser only (localStorage). */
export interface SavedPalette {
  id: string; // 'user:…'
  name: string;
  colors: string[];
}

const STORAGE_KEY = 'patola.palettes.v1';
export const USER_PALETTE_PREFIX = 'user:';

function isSavedPalette(value: unknown): value is SavedPalette {
  const palette = value as SavedPalette;
  return (
    typeof palette?.id === 'string' &&
    palette.id.startsWith(USER_PALETTE_PREFIX) &&
    typeof palette.name === 'string' &&
    Array.isArray(palette.colors) &&
    palette.colors.length === SLOT_COUNT &&
    palette.colors.every((colour) => typeof colour === 'string' && normalizeHex(colour) !== null)
  );
}

export function loadSavedPalettes(): SavedPalette[] {
  return readStoredList(STORAGE_KEY, isSavedPalette);
}

export function storeSavedPalettes(list: SavedPalette[]): boolean {
  return writeStoredList(STORAGE_KEY, list);
}

export const newPaletteId = (): string => newId(USER_PALETTE_PREFIX);
