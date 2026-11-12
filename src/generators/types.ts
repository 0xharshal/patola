import type { ParamSchema, ParamValues } from '../core/params';
import type { Rng } from '../core/rng';

export interface GenerateContext {
  /** Zone size in design cells (one cell = `threads per cell` threads). */
  width: number;
  height: number;
  /** Seeded randomness; same seed, same pattern. */
  random: Rng;
  /** The seed behind `random`, for generators that run elsewhere (custom code). */
  seed: number;
}

/**
 * A pattern generator fills a grid of palette slot indices (see SLOT).
 * Declare generators with `defineGenerator` so `generate` gets typed params.
 */
export interface Generator<Schema extends ParamSchema = ParamSchema> {
  id: string;
  name: string;
  /** Short educational description shown in the UI. */
  about: string;
  params: Schema;
  /** Custom generators depend on user content, so "Surprise me" never picks them. */
  userContent?: boolean;
  generate(params: ParamValues<Schema>, context: GenerateContext): Uint8Array;
}

/** Declare a generator; its parameter keys and choices become types for `generate`. */
export function defineGenerator<const Schema extends ParamSchema>(generator: Generator<Schema>): Generator<Schema> {
  return generator;
}

/** Palette slots a generator can paint with. */
export const SLOT = { ground: 0, primary: 1, secondary: 2, accent: 3, outline: 4 } as const;

/** Gold zari thread: not part of the palette, rendered as metal. */
export const ZARI_SLOT = 7;
