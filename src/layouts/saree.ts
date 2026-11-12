import type { ParamSchema, ParamValues } from '../core/params';
import { SLOT } from '../generators/types';
import { verticalLine } from './regions';
import { BODY_ZONE, defineLayout, type Region, type Size, type ZoneDef } from './types';

function longPieceSettings(defaultWidth: number, defaultLength: number, defaultEndShare: number) {
  return [
    {
      key: 'across',
      type: 'int',
      label: 'Width',
      min: 60,
      max: 600,
      default: defaultWidth,
      help: 'Width of the piece, in design cells',
    },
    {
      key: 'length',
      type: 'float',
      label: 'Length',
      min: 1.5,
      max: 6,
      step: 0.1,
      default: defaultLength,
      help: 'Length as a multiple of the width',
    },
    {
      key: 'border',
      type: 'float',
      label: 'Border width',
      min: 0.04,
      max: 0.25,
      step: 0.01,
      default: 0.12,
      help: 'Share of the width taken by each long border',
    },
    {
      key: 'end',
      type: 'float',
      label: 'End panel length',
      min: 0.08,
      max: 0.4,
      step: 0.01,
      default: defaultEndShare,
      help: 'Share of the length taken by each decorated end',
    },
    {
      key: 'band',
      type: 'int',
      label: 'Cross bands',
      min: 0,
      max: 24,
      default: 6,
      help: 'Narrow bands that separate the ends from the body',
    },
    { key: 'divider', type: 'int', label: 'Dividing lines', min: 0, max: 3, default: 1 },
  ] as const satisfies ParamSchema;
}

/** Settings shared by sarees and dupattas. */
type LongPieceSettings = ParamValues<ReturnType<typeof longPieceSettings>>;

function longPieceSize(settings: LongPieceSettings): Size {
  const width = settings.across;
  return { width: Math.round(width * settings.length), height: width };
}

/**
 * Body in the middle, long borders along both edges, a decorated end panel on the
 * right (and, for two-ended pieces, a mirrored one on the left), with cross bands
 * between ends and body.
 */
function longPieceRegions(settings: LongPieceSettings, size: Size, endZone: string, twoEnds: boolean): Region[] {
  const { width, height } = size;
  const borderWidth = Math.round(settings.border * height);
  const endLength = Math.round(settings.end * width);
  const bandWidth = settings.band;
  const lineWidth = settings.divider;
  const innerTop = borderWidth;
  const innerHeight = height - 2 * borderWidth;

  const leftEndLength = twoEnds ? endLength : 0;
  const bodyStart = leftEndLength + bandWidth;
  const rightBandStart = width - endLength - bandWidth;
  const rightEndStart = width - endLength;
  const inner = (x: number, w: number, extra: Partial<Region> = {}): Region => ({
    x,
    y: innerTop,
    width: w,
    height: innerHeight,
    ...extra,
  });

  const regions: Region[] = [
    { zone: 'border', x: 0, y: 0, width, height: borderWidth },
    { zone: 'border', x: 0, y: height - borderWidth, width, height: borderWidth, flipY: true },
    inner(leftEndLength, bandWidth, { zone: 'band', flipX: true }),
    inner(bodyStart, rightBandStart - bodyStart, { zone: BODY_ZONE }),
    inner(rightBandStart, bandWidth, { zone: 'band' }),
    inner(rightEndStart, endLength, { zone: endZone }),
  ];
  if (twoEnds) regions.push(inner(0, endLength, { zone: endZone, flipX: true }));

  if (lineWidth > 0) {
    regions.push(
      { fillSlot: SLOT.outline, x: 0, y: borderWidth - lineWidth, width, height: lineWidth },
      { fillSlot: SLOT.outline, x: 0, y: height - borderWidth, width, height: lineWidth },
    );
    const boundaries = new Set([leftEndLength, bodyStart, rightBandStart, rightEndStart].filter((x) => x > 0));
    for (const x of boundaries) regions.push(verticalLine(x, innerTop, innerHeight, lineWidth, SLOT.outline));
  }
  return regions;
}

const BORDER_ZONE: ZoneDef = {
  id: 'border',
  name: 'Borders',
  about: 'The two long edges. Borders run the full length and frame everything else.',
  fill: { generator: 'kinar', params: { motif: 'diamonds' } },
};

const BAND_ZONE: ZoneDef = {
  id: 'band',
  name: 'Cross bands',
  about: 'Narrow bands across the width, marking where the body ends.',
  fill: { generator: 'kinar', params: { motif: 'zigzag', teeth: false } },
};

export const saree = defineLayout({
  id: 'saree',
  name: 'Saree',
  about:
    'A patola saree: a long body framed by borders along both edges, ending in a decorated pallu that hangs over the shoulder. ' +
    'Shown lengthwise, so the warp runs left to right.',
  settings: longPieceSettings(200, 4.5, 0.22),
  body: { name: 'Body', about: 'The main field of the saree.' },
  zones: [
    BORDER_ZONE,
    {
      id: 'pallu',
      name: 'Pallu',
      about: 'The decorated end that drapes over the shoulder, usually the richest part.',
      fill: { generator: 'ratan-chowk', params: { size: 30, levels: 4 } },
    },
    BAND_ZONE,
  ],
  warpHorizontal: true,
  size: longPieceSize,
  regions: (settings, size) => longPieceRegions(settings, size, 'pallu', false),
});

export const dupatta = defineLayout({
  id: 'dupatta',
  name: 'Dupatta / odhani',
  about: 'A shorter shawl or veil with borders along both edges and a decorated panel at each end.',
  settings: longPieceSettings(160, 2.6, 0.16),
  body: { name: 'Body', about: 'The main field of the dupatta.' },
  zones: [
    BORDER_ZONE,
    {
      id: 'end',
      name: 'End panels',
      about: 'Decorated panels at both ends, mirrored.',
      fill: { generator: 'phool', params: { repeat: 22 } },
    },
    BAND_ZONE,
  ],
  warpHorizontal: true,
  size: longPieceSize,
  regions: (settings, size) => longPieceRegions(settings, size, 'end', true),
});
