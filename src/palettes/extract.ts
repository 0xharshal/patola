import { SLOT_COUNT } from './presets';

type Rgb = [number, number, number];

const toHex = (rgb: Rgb) => '#' + rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');
const luminance = ([red, green, blue]: Rgb) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;
const squaredDistance = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export interface Quantized {
  /** One colour per palette slot, in slot order; '' for the ground of a cut-out image. */
  colours: string[];
  /** Palette slot of every pixel (transparent pixels → ground). */
  slots: Uint8Array;
}

/** Share of transparent pixels above which an image counts as a cut-out motif. */
const CUT_OUT_THRESHOLD = 0.05;

/**
 * Reduce an RGBA image to palette slots with k-means (deterministic).
 *
 * Photos: most common colour → ground (0), darkest of the rest → outline
 * (last slot), the others by frequency → primary, secondary, accent.
 * Cut-out motifs (transparent background): the background is the ground and
 * the motif's own colours fill the other slots, so the motif never vanishes
 * into the ground.
 */
export function quantizeImage(rgba: Uint8ClampedArray | Uint8Array, slotCount = SLOT_COUNT): Quantized | null {
  const pixelCount = Math.floor(rgba.length / 4);
  const opaque: number[] = [];
  for (let pixel = 0; pixel < pixelCount; pixel++) if (rgba[pixel * 4 + 3] >= 128) opaque.push(pixel);
  if (opaque.length === 0) return null;
  const isCutOut = opaque.length < pixelCount * (1 - CUT_OUT_THRESHOLD);
  const clusterCount = isCutOut ? slotCount - 1 : slotCount;
  const colourOf = (pixel: number): Rgb => [rgba[pixel * 4], rgba[pixel * 4 + 1], rgba[pixel * 4 + 2]];

  // Farthest-point initialisation: start from the mean colour, then keep adding
  // the pixel farthest from all chosen centres.
  const mean = [0, 1, 2].map(
    (channel) => opaque.reduce((sum, pixel) => sum + rgba[pixel * 4 + channel], 0) / opaque.length,
  ) as Rgb;
  const centres: Rgb[] = [mean];
  while (centres.length < clusterCount) {
    let farthest = colourOf(opaque[0]);
    let farthestDistance = -1;
    for (const pixel of opaque) {
      const colour = colourOf(pixel);
      const distance = Math.min(...centres.map((centre) => squaredDistance(colour, centre)));
      if (distance > farthestDistance) [farthest, farthestDistance] = [colour, distance];
    }
    centres.push(farthest);
  }

  const nearestCentre = (colour: Rgb) => {
    let best = 0;
    for (let index = 1; index < centres.length; index++) {
      if (squaredDistance(colour, centres[index]) < squaredDistance(colour, centres[best])) best = index;
    }
    return best;
  };

  const counts = new Array<number>(clusterCount).fill(0);
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centres.map(() => [0, 0, 0]);
    counts.fill(0);
    for (const pixel of opaque) {
      const colour = colourOf(pixel);
      const cluster = nearestCentre(colour);
      counts[cluster]++;
      for (let channel = 0; channel < 3; channel++) sums[cluster][channel] += colour[channel];
    }
    centres.forEach((centre, cluster) => {
      if (counts[cluster] > 0)
        for (let channel = 0; channel < 3; channel++) centre[channel] = sums[cluster][channel] / counts[cluster];
    });
  }

  // Order clusters into slots: [ground,] most common first, darkest last (outline).
  const byFrequency = centres.map((_, cluster) => cluster).sort((a, b) => counts[b] - counts[a]);
  const ground = isCutOut ? null : byFrequency.shift()!;
  const darkest = byFrequency.reduce((best, cluster) =>
    luminance(centres[cluster]) < luminance(centres[best]) ? cluster : best,
  );
  const motifOrder = [...byFrequency.filter((cluster) => cluster !== darkest), darkest];
  const firstMotifSlot = isCutOut ? 1 : 0;
  const slotOrder = ground === null ? motifOrder : [ground, ...motifOrder];
  const slotOfCluster = new Map(slotOrder.map((cluster, index) => [cluster, index + firstMotifSlot]));

  const slots = new Uint8Array(pixelCount); // transparent pixels stay 0 (ground)
  for (const pixel of opaque) slots[pixel] = slotOfCluster.get(nearestCentre(colourOf(pixel)))!;
  const colours = slotOrder.map((cluster) => toHex(centres[cluster]));
  return { colours: isCutOut ? ['', ...colours] : colours, slots };
}

/** The main colours of an image, in palette slot order. */
export function extractPalette(rgba: Uint8ClampedArray | Uint8Array): string[] | null {
  return quantizeImage(rgba)?.colours ?? null;
}
