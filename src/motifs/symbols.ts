/**
 * Auspicious symbols and folk figures of Gujarat, drawn as shapes so they can be
 * rasterised onto the thread grid at any size (see sketch.ts). Each is drawn in
 * its own box of design units; slots: 1 primary, 2 secondary, 3 accent,
 * Z zari (gold); the outline is added around everything.
 */
import { SLOT, ZARI_SLOT } from '../generators/types';
import { MotifSketch } from './sketch';
import type { MotifGrid } from './format';

const { primary: P, secondary: S, accent: A, outline: O } = SLOT;
const Z = ZARI_SLOT;

export interface SymbolDef {
  id: string;
  name: string;
  about: string;
  /** Design box, in design units. */
  width: number;
  height: number;
  /** A figure facing one way, which may be mirrored to face the other. Script and sacred signs are never mirrored. */
  faces?: boolean;
  draw(sketch: MotifSketch): void;
}

/** A wheel: rim, coloured rings inside it, spokes, rim loops between them and a hub. */
export interface WheelOptions {
  /** Coloured rings inside the rim (0 = none). */
  rings: number;
  /** Spokes (0 = none). */
  spokes: number;
  /** Small loops on the rim between the spokes, as on the Ashoka chakra. */
  rimLoops: boolean;
  /** Hub radius as a share of the wheel radius. */
  hub: number;
}

/** Draw a wheel filling a 32 × 32 box. */
export function drawWheel(sketch: MotifSketch, { rings, spokes, rimLoops, hub }: WheelOptions): void {
  const centre = [16, 16] as const;
  const rim = 14.5;
  const rimWidth = 1.8;
  // Rings alternate through the palette, from the rim inwards; the first differs from the rim and spokes.
  const ringColours = [S, A, P];
  const ringWidth = (rim - rimWidth) / Math.max(1, rings + 0.5);
  for (let ring = 0; ring < rings; ring++) {
    const outer = rim - rimWidth - ring * ringWidth;
    sketch.ring(centre, outer - ringWidth, outer, ringColours[ring % 3]);
  }
  sketch.ring(centre, rim - rimWidth, rim, P);
  // Thin spokes, starting a little outside the hub so they don't merge there.
  if (spokes > 0) sketch.spokes(centre, rim * Math.max(hub, 0.18), rim - rimWidth, spokes, 0.55, P);
  if (rimLoops && spokes > 0) {
    for (let loop = 0; loop < spokes; loop++) {
      const at = MotifSketch.onCircle(centre, rim - rimWidth - 0.6, (360 * (loop + 0.5)) / spokes);
      sketch.disc(at, 0.75, P);
    }
  }
  if (hub > 0) sketch.disc(centre, rim * hub, rings > 0 || spokes > 0 ? A : P);
}

export const SYMBOLS: SymbolDef[] = [
  {
    id: 'diya',
    name: 'Diya (lamp)',
    about: 'The clay oil lamp of Diwali and every puja: light over darkness.',
    width: 32,
    height: 30,
    draw(sketch) {
      sketch.fill(P, ([x, y]) => y >= 18 && ((x - 16) / 13) ** 2 + ((y - 18) / 8) ** 2 <= 1);
      sketch.ellipse([16, 18], 14, 2.4, S);
      for (const dot of [
        [8, 21.5],
        [12, 23],
        [16, 23.5],
        [20, 23],
        [24, 21.5],
      ] as const)
        sketch.disc(dot, 1, A);
      sketch.polygon(
        [
          [12, 25.5],
          [20, 25.5],
          [22, 29.5],
          [10, 29.5],
        ],
        S,
      );
      sketch.ellipse([16, 10], 3.6, 5, A);
      sketch.polygon(
        [
          [16, 1],
          [12.6, 9],
          [19.4, 9],
        ],
        A,
      );
      sketch.ellipse([16, 11.2], 1.6, 2.8, Z);
      sketch.line([16, 15], [16, 17], 1.2, O);
    },
  },
  {
    id: 'saathiya',
    name: 'Saathiya (swastika)',
    about:
      'The Hindu swastika, drawn at doorways and on account books for good fortune; its four dots stand for the four directions.',
    width: 32,
    height: 32,
    draw(sketch) {
      const [near, far, inner, outer] = [13.75, 18.25, 6.5, 25.5];
      sketch.rect(near, 2, far, 30, P).rect(2, near, 30, far, P);
      // The arms turn clockwise: top to the right, right downwards, bottom to the left, left upwards.
      sketch.rect(near, 2, 30, inner, P).rect(outer, near, 30, 30, P);
      sketch.rect(2, outer, far, 30, P).rect(2, 2, inner, far, P);
      for (const [x, y] of [
        [10.1, 10.1],
        [21.9, 10.1],
        [21.9, 21.9],
        [10.1, 21.9],
      ] as const)
        sketch.disc([x, y], 2.2, A);
    },
  },
  {
    id: 'mor',
    faces: true,
    name: 'Mor (peacock)',
    about: 'The peacock, national bird and a favourite of Gujarati embroidery and patola, with its eyed tail.',
    width: 36,
    height: 32,
    draw(sketch) {
      sketch.polygon(
        [
          [18, 14.5],
          [35, 5],
          [36, 15],
          [35, 27],
          [18, 21.5],
        ],
        S,
      );
      for (const [x, y] of [
        [29, 10],
        [32, 16.5],
        [29, 22.5],
        [23.5, 13.5],
        [23.5, 19.5],
      ] as const)
        sketch.disc([x, y], 2.3, A).disc([x, y], 1, P);
      sketch.ellipse([16, 18], 7, 5, P);
      sketch.ellipse([17.5, 17], 4.5, 3, S);
      sketch.line([10, 15], [7.5, 7], 3, P);
      sketch.disc([7, 6], 2.4, P);
      sketch.polygon(
        [
          [4.8, 5.4],
          [2.2, 6.6],
          [4.9, 7.4],
        ],
        A,
      );
      for (const tip of [
        [5.6, 1.4],
        [8.2, 1],
        [10.6, 1.8],
      ] as const)
        sketch.line([7.8, 3.8], tip, 0.8, O).disc(tip, 0.9, A);
      sketch.line([14.5, 22.5], [13.5, 29], 1.2, O).line([18, 22.5], [18.5, 29], 1.2, O);
      sketch.line([11.5, 29.5], [15.5, 29.5], 1, O).line([16.5, 29.5], [20.5, 29.5], 1, O);
    },
  },
  {
    id: 'keri',
    faces: true,
    name: 'Keri (mango)',
    about: 'The mango, fruit of plenty; its curled shape is the paisley of Indian textiles.',
    width: 31,
    height: 32,
    draw(sketch) {
      const [start, control, end] = [[14, 20] as const, [4, 4] as const, [22, 3] as const];
      sketch.sweep(start, control, end, 10, 0.6, P);
      sketch.sweep(start, control, end, 7.4, 0.1, S);
      sketch.sweep(start, control, end, 4.6, -1, A);
      sketch.disc([14, 21], 1.5, Z);
      sketch.polygon(
        [
          [22, 3.5],
          [27.5, 0.8],
          [29.5, 4],
          [25, 6.5],
        ],
        S,
      );
    },
  },
  {
    id: 'patang',
    name: 'Patang (kite)',
    about: 'The paper kite of Uttarayan, when all of Gujarat flies kites from the rooftops.',
    width: 30,
    height: 36,
    draw(sketch) {
      sketch.polygon(
        [
          [15, 1],
          [1, 13],
          [15, 30],
        ],
        P,
      );
      sketch.polygon(
        [
          [15, 1],
          [29, 13],
          [15, 30],
        ],
        S,
      );
      sketch.polygon(
        [
          [15, 1],
          [10.3, 5],
          [19.7, 5],
        ],
        A,
      );
      sketch.line([15, 1], [15, 30], 0.8, O);
      // The bow: a stick bent between the side corners.
      sketch.arc([15, 35.5], 26.5, -122, -58, 0.8, O);
      sketch.polygon(
        [
          [15, 30],
          [11.5, 35],
          [18.5, 35],
        ],
        A,
      );
    },
  },
  {
    id: 'dandiya',
    name: 'Dandiya (sticks)',
    about: 'A pair of decorated sticks for the dandiya raas dance of Navratri.',
    width: 32,
    height: 32,
    draw(sketch) {
      const ends = [
        [
          [5, 5],
          [27, 27],
        ],
        [
          [27, 5],
          [5, 27],
        ],
      ] as const;
      for (const [from, to] of ends) {
        sketch.line(from, to, 2.2, S);
        for (const t of [0.22, 0.36, 0.64, 0.78]) {
          const at = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as const;
          sketch.disc(at, 1.5, A);
        }
      }
      for (const [x, y] of [
        [3.5, 3.5],
        [28.5, 3.5],
        [3.5, 28.5],
        [28.5, 28.5],
      ] as const)
        sketch.disc([x, y], 2.3, P).disc([x, y], 0.9, Z);
    },
  },
  {
    id: 'om',
    name: 'Om',
    about: 'The sacred sound Om, written in Devanagari script.',
    width: 30,
    height: 32,
    draw(sketch) {
      sketch.arc([10, 11], 4.5, 200, 90, 2.6, P);
      sketch.arc([10.5, 20.5], 5.2, 270, 150, 2.6, P);
      sketch.arc([20, 18], 5, 190, 110, 2.6, P);
      sketch.arc([19, 5.5], 4.5, 20, 160, 2, S);
      sketch.disc([19, 2.2], 1.7, A);
    },
  },
  {
    id: 'trishul',
    name: 'Trishul (trident)',
    about: "Shiva's trident, with the small damru drum tied to its shaft.",
    width: 30,
    height: 40,
    draw(sketch) {
      sketch.line([15, 9], [15, 39], 2, S);
      sketch.arc([15, 10], 8, 0, 180, 2.2, Z);
      for (const x of [7, 23]) {
        sketch.line([x, 10], [x, 4], 2.2, Z);
        sketch.polygon(
          [
            [x, 0.5],
            [x - 2.5, 5],
            [x + 2.5, 5],
          ],
          Z,
        );
      }
      sketch.line([15, 18], [15, 4], 2.4, Z);
      sketch.polygon(
        [
          [15, 0],
          [12, 5],
          [18, 5],
        ],
        Z,
      );
      sketch.polygon(
        [
          [11, 23],
          [19, 23],
          [15, 27],
          [11, 31],
          [19, 31],
          [15, 27],
        ],
        A,
      );
      sketch.line([11, 23], [19, 23], 1, P).line([11, 31], [19, 31], 1, P);
    },
  },
  {
    id: 'dhanush',
    faces: true,
    name: 'Dhanush-baan (bow and arrow)',
    about: 'The bow and arrow of Rama: aim and resolve.',
    width: 32,
    height: 32,
    draw(sketch) {
      sketch.arc([2, 16], 14, -65, 65, 2.2, S);
      const nock = [4, 16] as const;
      sketch.line([7.9, 3.3], nock, 0.7, O).line(nock, [7.9, 28.7], 0.7, O);
      sketch.line(nock, [27, 16], 1, P);
      sketch.polygon(
        [
          [31.5, 16],
          [26, 12.5],
          [26, 19.5],
        ],
        Z,
      );
      sketch.polygon(
        [
          [5, 15.5],
          [2, 12],
          [8, 15.5],
        ],
        A,
      );
      sketch.polygon(
        [
          [5, 16.5],
          [2, 20],
          [8, 16.5],
        ],
        A,
      );
    },
  },
  {
    id: 'hansa',
    faces: true,
    name: 'Hansa (swan)',
    about: 'The swan, mount of Saraswati: grace and wisdom; a classic border bird of patola.',
    width: 34,
    height: 28,
    draw(sketch) {
      sketch.polygon(
        [
          [27, 16],
          [33.5, 10],
          [31.5, 20],
        ],
        P,
      );
      sketch.ellipse([19, 19.5], 11, 6, P);
      sketch.ellipse([21, 17.5], 6.5, 3.5, S);
      sketch.line([16, 17.5], [26, 15.5], 0.7, O).line([17, 19.5], [27, 17.5], 0.7, O);
      sketch.arc([8, 10.5], 4, -100, 80, 2.6, P);
      sketch.line([8.7, 14.4], [10.5, 17], 2.6, P);
      sketch.disc([6, 5.8], 2.3, P);
      sketch.polygon(
        [
          [3.9, 5.2],
          [0.8, 6.8],
          [4, 7.2],
        ],
        A,
      );
      sketch.line([6, 26.8], [32, 26.8], 1, S);
    },
  },
  {
    id: 'charkha',
    faces: true,
    name: 'Charkha (spinning wheel)',
    about: 'The spinning wheel Gandhi made a symbol of self-reliance; it spins the yarn before it is dyed and woven.',
    width: 34,
    height: 30,
    draw(sketch) {
      const hub = [12, 13] as const;
      sketch.line([12, 2.5], [26, 18], 0.6, O).line([12, 23.5], [26, 20], 0.6, O);
      sketch.ring(hub, 9.5, 11, S);
      sketch.spokes(hub, 1.5, 10, 8, 1, S, 22.5);
      sketch.line(hub, [7, 27], 1.4, P).line(hub, [17, 27], 1.4, P);
      sketch.disc(hub, 2, A);
      sketch.line([1, 28], [33, 28], 2, P);
      sketch.line([28, 27], [28, 19], 1.4, P);
      sketch.line([23.5, 19], [33.5, 19], 0.8, O);
      sketch.ellipse([30.5, 19], 2.5, 1.4, A);
    },
  },
  {
    id: 'chakra',
    name: 'Ashoka chakra',
    about: 'The wheel of dharma with 24 spokes, from the lion capital of Ashoka and the flag of India.',
    width: 32,
    height: 32,
    draw: (sketch) => drawWheel(sketch, { rings: 0, spokes: 24, rimLoops: true, hub: 0.2 }),
  },
  {
    id: 'circles',
    name: 'Concentric circles',
    about: 'Rings within rings, like ripples on water or the bindu at the centre of a mandala.',
    width: 32,
    height: 32,
    draw: (sketch) => drawWheel(sketch, { rings: 5, spokes: 0, rimLoops: false, hub: 0.12 }),
  },
];

export function getSymbol(id: string): SymbolDef {
  return SYMBOLS.find((symbol) => symbol.id === id) ?? SYMBOLS[0];
}

/** A symbol rasterised to `height` cells (width follows its proportions), outlined if asked. */
export function symbolGrid(symbol: SymbolDef, height: number, outline = true): MotifGrid {
  const sketch = new MotifSketch(symbol.width, symbol.height, height / symbol.height);
  symbol.draw(sketch);
  if (outline) sketch.outline();
  return sketch.grid();
}
