/** Reading pictures the user picks (browser only). */

export interface ImagePixels {
  width: number;
  height: number;
  /** RGBA, row by row. */
  rgba: Uint8ClampedArray;
}

/** Decode an image file, shrunk so its longer side is at most `maxSide` pixels (never enlarged). */
export async function readImagePixels(file: Blob, maxSide: number): Promise<ImagePixels> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { width, height, rgba: context.getImageData(0, 0, width, height).data };
}
