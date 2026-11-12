import { describe, expect, it } from 'vitest';
import { createPngWriter, crc32 } from '../src/export/png';
import { buildSvg, gridRectangles } from '../src/export/svg';
import { imageSize, scaleForLongSide } from '../src/export/sizes';
import { compactQuery, expandCompactSearch } from '../src/core/compactLink';
import { designFromFile, designToFile, userMotifIds } from '../src/core/designFile';
import { applyLayout, defaultDesign } from '../src/core/design';
import { designToQuery, parseUrl } from '../src/core/url';
import { newUserMotif, saveMotif } from '../src/motifs/library';
import { parseMotifRows } from '../src/motifs/format';

async function inflate(parts: Uint8Array[]): Promise<Uint8Array> {
  const stream = new Blob(parts.map((part) => part.slice())).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Minimal PNG reader for tests: chunks with CRC check, and unfiltered RGB rows. */
async function readPng(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  const idat: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    expect(view.getUint32(offset + 8 + length)).toBe(
      (crc32(bytes.subarray(offset + 4, offset + 8 + length)) ^ 0xffffffff) >>> 0,
    );
    if (type === 'IHDR') [width, height] = [view.getUint32(offset + 8), view.getUint32(offset + 12)];
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const raw = await inflate(idat);
  const rowBytes = 1 + width * 3;
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * rowBytes];
    for (let x = 0; x < width * 3; x++) {
      const left = x >= 3 ? pixels[y * width * 3 + x - 3] : 0;
      pixels[y * width * 3 + x] = (raw[y * rowBytes + 1 + x] + (filter === 1 ? left : 0)) & 0xff;
    }
  }
  return { width, height, pixels };
}

describe('png', () => {
  it('writes a valid PNG whose pixels decode back exactly', async () => {
    const width = 5;
    const height = 3;
    const rgba = new Uint8Array(width * height * 4).map((_, index) => (index * 37) % 256);
    const writer = createPngWriter(width, height);
    await writer.writeRows(rgba.subarray(0, width * 2 * 4), 2); // rows arrive in bands
    await writer.writeRows(rgba.subarray(width * 2 * 4), 1);
    const png = new Uint8Array(await (await writer.finish()).arrayBuffer());
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const decoded = await readPng(png);
    expect([decoded.width, decoded.height]).toEqual([width, height]);
    for (let pixel = 0; pixel < width * height; pixel++) {
      expect([...decoded.pixels.subarray(pixel * 3, pixel * 3 + 3)]).toEqual([
        ...rgba.subarray(pixel * 4, pixel * 4 + 3),
      ]);
    }
  });
});

describe('svg', () => {
  const grid = { ...parseMotifRows(['1122', '1122', '3333']), slots: parseMotifRows(['1122', '1122', '3333']).slots };

  it('covers every cell exactly once with merged rectangles', () => {
    const rectangles = gridRectangles(grid);
    expect(rectangles).toHaveLength(3); // two 2×2 blocks and one 4×1 row
    const covered = new Uint8Array(grid.width * grid.height);
    for (const { x, y, width, height, slot } of rectangles) {
      for (let row = y; row < y + height; row++) {
        for (let column = x; column < x + width; column++) {
          covered[row * grid.width + column]++;
          expect(grid.slots[row * grid.width + column]).toBe(slot);
        }
      }
    }
    expect(covered.every((count) => count === 1)).toBe(true);
  });

  it('builds an SVG with one path per colour', () => {
    const svg = buildSvg(grid, ['#000000', '#ff0000', '#00ff00', '#0000ff', '#111111'], 10, 'Test <design>');
    expect(svg).toContain('viewBox="0 0 4 3"');
    expect(svg).toContain('width="40"');
    expect(svg.match(/<path /g)).toHaveLength(3);
    expect(svg).toContain('Test &#60;design&#62;');
  });
});

describe('sizes', () => {
  it('scales the long side to the requested pixels', () => {
    const piece = { width: 2000, height: 500 };
    const scale = scaleForLongSide(piece, 4000);
    expect(imageSize(piece, scale)).toEqual({ width: 4000, height: 1000 });
  });
});

describe('compact links', () => {
  it('round-trips, and readable parameters next to d= win', async () => {
    const query = designToQuery(parseUrl('?layout=saree&seed=7&gen=custom-code').design);
    const compact = await compactQuery(query);
    expect(compact.length).toBeLessThan(query.length);
    const expanded = await expandCompactSearch(`?${compact}&seed=9&view=wallpaper`);
    const { design, view } = parseUrl(expanded);
    expect(design.layout).toBe('saree');
    expect(design.seed).toBe(9);
    expect(view).toBe('wallpaper');
  });

  it('ignores broken compact data', async () => {
    expect(await expandCompactSearch('?d=%%%&seed=3')).toBe('?seed=3');
  });
});

describe('design files', () => {
  it('round-trip the design and carry the user motifs it uses', () => {
    const motif = newUserMotif('Star', parseMotifRows(['.1.', '111', '.1.']));
    saveMotif(motif);
    const design = defaultDesign();
    applyLayout(design, 'gharchola');
    design.zones.cellB = {
      generator: 'image',
      params: { asset: motif.id, scale: 2, gap: 4, arrangement: 'grid', mirror: false },
    };
    expect(userMotifIds(design)).toEqual([motif.id]);

    const file = JSON.parse(JSON.stringify(designToFile(design)));
    expect(file.motifs).toHaveLength(1);
    expect(file.motifs[0].rows).toEqual(['.1.', '111', '.1.']);
    const opened = designFromFile(file);
    expect('design' in opened && opened.design).toEqual(parseUrl(`?${designToQuery(design)}`).design);
  });

  it('rejects other files', () => {
    expect(designFromFile({ hello: 'world' })).toHaveProperty('error');
  });
});

describe('url extras', () => {
  it('reads download requests and clamps their size', () => {
    expect(parseUrl('?download=png&size=999999').download).toEqual({ format: 'png', longSide: 30000 });
    expect(parseUrl('?download=svg').download).toEqual({ format: 'svg', longSide: null });
    expect(parseUrl('?download=exe').download).toBeNull();
  });

  it('re-rolls the requested aspects on every load', () => {
    const seeds = new Set(Array.from({ length: 5 }, () => parseUrl('?seed=1&random=seed').design.seed));
    expect(seeds.size).toBeGreaterThan(1);
    const palettes = new Set(
      Array.from({ length: 8 }, () => parseUrl('?palette=jewel&random=colours').design.palette.join()),
    );
    expect(palettes.size).toBeGreaterThan(1);
  });
});
