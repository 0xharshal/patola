/** Seeded pseudo-random numbers, so every design is reproducible from its seed. */
export type Rng = () => number;

export const MAX_SEED = 999_999;

/** mulberry32: small, fast, good enough for visual randomness. Returns [0, 1). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, human-friendly seed (0…999999). */
export function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}
