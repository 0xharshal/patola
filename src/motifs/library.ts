/**
 * The motif library: built-in motifs plus the user's own (uploaded images and
 * motifs drawn in the grid editor), kept in this browser (localStorage).
 * Motifs are grids of palette slots, so they recolour with any palette and get
 * the same ikat bleed as generated patterns.
 */
import { quantizeImage } from '../palettes/extract';
import { readImagePixels } from '../core/imageFile';
import { newId, readStoredList, writeStored } from '../custom/storage';
import { base64ToBytes, bytesToBase64 } from '../core/base64';
import { createChangeSignal } from '../core/changeSignal';
import { BUILT_IN_MOTIFS } from './builtin';
import { MAX_MOTIF_CELLS, type MotifGrid } from './format';

export interface Motif extends MotifGrid {
  id: string; // 'builtin:…' or 'asset:…'
  name: string;
  /** Colours of an uploaded image, in slot order ('' = keep), to offer as a palette. Empty for drawn motifs. */
  colours: string[];
  builtIn?: boolean;
  about?: string;
  /** False for signs that must never be mirrored (saathiya, Om). */
  mirrorable?: boolean;
}

interface StoredMotif extends Omit<Motif, 'slots'> {
  slots: string; // base64
}

const STORAGE_KEY = 'patola.assets.v1';
export const USER_MOTIF_PREFIX = 'asset:';

const builtInMotifs: Motif[] = BUILT_IN_MOTIFS.map((motif) => ({ ...motif, colours: [], builtIn: true }));

function isStoredMotif(value: unknown): value is StoredMotif {
  const motif = value as StoredMotif;
  return (
    typeof motif?.id === 'string' &&
    motif.id.startsWith(USER_MOTIF_PREFIX) &&
    typeof motif.name === 'string' &&
    Number.isInteger(motif.width) &&
    Number.isInteger(motif.height) &&
    motif.width > 0 &&
    motif.height > 0 &&
    motif.width <= MAX_MOTIF_CELLS &&
    motif.height <= MAX_MOTIF_CELLS &&
    typeof motif.slots === 'string' &&
    Array.isArray(motif.colours)
  );
}

let userMotifs: Motif[] | null = null;
const motifsChanged = createChangeSignal();

function loadUserMotifs(): Motif[] {
  userMotifs ??= readStoredList(STORAGE_KEY, isStoredMotif)
    .map((stored) => ({ ...stored, slots: base64ToBytes(stored.slots) }))
    .filter((motif) => motif.slots.length === motif.width * motif.height);
  return userMotifs;
}

/** Persist the user's motifs; false if storage is full or unavailable (they stay usable until reload). */
function saveUserMotifs(): boolean {
  const ok = writeStored(
    STORAGE_KEY,
    loadUserMotifs().map((motif) => ({ ...motif, slots: bytesToBase64(motif.slots) })),
  );
  motifsChanged.notify();
  return ok;
}

export function listMotifs(): Motif[] {
  return [...builtInMotifs, ...loadUserMotifs()];
}

export function getMotif(id: string): Motif | undefined {
  return builtInMotifs.find((motif) => motif.id === id) ?? loadUserMotifs().find((motif) => motif.id === id);
}

export const onMotifsChanged = motifsChanged.subscribe;

export function newUserMotif(name: string, grid: MotifGrid, colours: string[] = []): Motif {
  return { id: newId(USER_MOTIF_PREFIX), name, colours, ...grid };
}

/** Add a new motif or replace the user's motif with the same id. */
export function saveMotif(motif: Motif): boolean {
  const motifs = loadUserMotifs();
  const index = motifs.findIndex((existing) => existing.id === motif.id);
  if (index >= 0) motifs[index] = motif;
  else motifs.push(motif);
  return saveUserMotifs();
}

export function deleteMotif(id: string): void {
  userMotifs = loadUserMotifs().filter((motif) => motif.id !== id);
  saveUserMotifs();
}

/** Downscale an image file to at most `maxCells` on its longer side and reduce it to palette slots. */
export async function motifFromImage(file: File, maxCells: number): Promise<Motif> {
  const { width, height, rgba } = await readImagePixels(file, maxCells);
  const quantized = quantizeImage(rgba);
  if (!quantized) throw new Error('The image has no visible pixels.');
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Image';
  return newUserMotif(name, { width, height, slots: quantized.slots }, quantized.colours);
}
