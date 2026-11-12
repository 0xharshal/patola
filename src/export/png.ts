/**
 * Streaming PNG encoder. Rows are compressed as they arrive with the browser's
 * built-in CompressionStream ('deflate' = zlib, as PNG requires), so images far
 * larger than any canvas can be written without holding them uncompressed.
 */

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 3; // RGB, 8 bits per channel
const FILTER_SUB = 1; // each byte minus the byte one pixel to the left: good for textiles

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array, start = 0xffffffff): number {
  let crc = start;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc;
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, (crc32(data, crc32(typeBytes)) ^ 0xffffffff) >>> 0);
  return out;
}

function header(width: number, height: number): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8; // bit depth
  data[9] = 2; // colour type: RGB
  // compression, filter and interlace methods stay 0
  return chunk('IHDR', data);
}

export interface PngWriter {
  /** Append rows of RGBA pixels (alpha is dropped), top to bottom. */
  writeRows(rgba: Uint8Array, rowCount: number): Promise<void>;
  /** Finish and return the PNG file. */
  finish(): Promise<Blob>;
  /** Stop early and release the stream. */
  abort(): void;
}

export function createPngWriter(width: number, height: number): PngWriter {
  const compressor = new CompressionStream('deflate');
  const writer = compressor.writable.getWriter();
  const parts: BlobPart[] = [SIGNATURE, header(width, height)];

  // Collect compressed output while rows are written; each piece becomes an IDAT chunk.
  const reading = (async () => {
    const reader = compressor.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value.length > 0) parts.push(chunk('IDAT', value));
    }
  })();
  // After abort() the stream errors; finish() still sees errors, but none goes unhandled.
  reading.catch(() => {});

  const rowBytes = 1 + width * BYTES_PER_PIXEL;
  return {
    async writeRows(rgba, rowCount) {
      const filtered = new Uint8Array(rowBytes * rowCount);
      for (let row = 0; row < rowCount; row++) {
        const target = row * rowBytes;
        const source = row * width * 4;
        filtered[target] = FILTER_SUB;
        for (let x = 0; x < width; x++) {
          for (let channel = 0; channel < BYTES_PER_PIXEL; channel++) {
            const value = rgba[source + x * 4 + channel];
            const left = x > 0 ? rgba[source + (x - 1) * 4 + channel] : 0;
            filtered[target + 1 + x * BYTES_PER_PIXEL + channel] = (value - left) & 0xff;
          }
        }
      }
      await writer.write(filtered);
    },
    async finish() {
      await writer.close();
      await reading;
      parts.push(chunk('IEND', new Uint8Array(0)));
      return new Blob(parts, { type: 'image/png' });
    },
    abort() {
      writer.abort().catch(() => {});
    },
  };
}
