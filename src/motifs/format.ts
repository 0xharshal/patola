/**
 * Motifs as readable text: one character per cell, one string per row.
 *
 *   .  ground      1  primary     2  secondary
 *   3  accent      #  outline     Z  zari (gold)
 *
 * Used for the built-in motifs and for the grid editor's JSON files, so a motif
 * can be read, diffed and edited by hand.
 */
import { SLOT, ZARI_SLOT } from '../generators/types';

const SLOT_BY_CHARACTER: Record<string, number> = {
  '.': SLOT.ground,
  '1': SLOT.primary,
  '2': SLOT.secondary,
  '3': SLOT.accent,
  '#': SLOT.outline,
  Z: ZARI_SLOT,
};
const CHARACTER_BY_SLOT = new Map(Object.entries(SLOT_BY_CHARACTER).map(([character, slot]) => [slot, character]));

export const MAX_MOTIF_CELLS = 128;
export const MOTIF_FILE_FORMAT = 'patola-motif';
export const MOTIF_FILE_VERSION = 1;

export interface MotifGrid {
  width: number;
  height: number;
  /** Palette slot per cell, row by row. */
  slots: Uint8Array;
}

/** Parse rows of motif characters. Unknown characters count as ground; short rows are padded. */
export function parseMotifRows(rows: string[]): MotifGrid {
  const height = rows.length;
  const width = Math.max(1, ...rows.map((row) => row.length));
  const slots = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) slots[y * width + x] = SLOT_BY_CHARACTER[row[x]] ?? SLOT.ground;
  });
  return { width, height, slots };
}

/** Parse a motif drawn in a template string (blank first/last lines and indentation are ignored). */
export function motifFromArt(art: string): MotifGrid {
  const lines = art
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return parseMotifRows(lines);
}

export function motifToRows({ width, height, slots }: MotifGrid): string[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => CHARACTER_BY_SLOT.get(slots[y * width + x]) ?? '.').join(''),
  );
}

export interface MotifFile {
  format: typeof MOTIF_FILE_FORMAT;
  version: number;
  name: string;
  rows: string[];
}

export function motifToFile(name: string, motif: MotifGrid): MotifFile {
  return { format: MOTIF_FILE_FORMAT, version: MOTIF_FILE_VERSION, name, rows: motifToRows(motif) };
}

/** Read a motif file, or explain why it can't be used. */
export function motifFromFile(json: unknown): { name: string; motif: MotifGrid } | { error: string } {
  const file = json as Partial<MotifFile>;
  if (file?.format !== MOTIF_FILE_FORMAT) return { error: 'This is not a patola motif file.' };
  if (!Array.isArray(file.rows) || file.rows.length === 0 || !file.rows.every((row) => typeof row === 'string')) {
    return { error: 'The motif file has no rows of cells.' };
  }
  const motif = parseMotifRows(file.rows);
  if (motif.width > MAX_MOTIF_CELLS || motif.height > MAX_MOTIF_CELLS) {
    return { error: `Motifs can be at most ${MAX_MOTIF_CELLS} × ${MAX_MOTIF_CELLS} cells.` };
  }
  return { name: typeof file.name === 'string' && file.name.trim() ? file.name.trim().slice(0, 40) : 'Motif', motif };
}
