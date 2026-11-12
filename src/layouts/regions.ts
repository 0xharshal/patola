/** Helpers for building layout regions. */
import type { Rect, Region } from './types';

export function insetRect(rect: Rect, by: number): Rect {
  return { x: rect.x + by, y: rect.y + by, width: rect.width - 2 * by, height: rect.height - 2 * by };
}

/**
 * A frame of `thickness` along the inside edges of `outer`, painted with `zone`.
 * Bottom and right sides are mirrored so every side faces inwards. With a
 * `cornerZone`, the four corner squares get their own pattern.
 */
export function frameRegions(zone: string, outer: Rect, thickness: number, cornerZone?: string): Region[] {
  if (thickness <= 0) return [];
  const { x, y, width, height } = outer;
  const right = x + width - thickness;
  const bottom = y + height - thickness;
  const sideStart = cornerZone ? x + thickness : x;
  const sideWidth = cornerZone ? width - 2 * thickness : width;
  const regions: Region[] = [
    { zone, x: sideStart, y, width: sideWidth, height: thickness },
    { zone, x: sideStart, y: bottom, width: sideWidth, height: thickness, flipY: true },
    { zone, x, y: y + thickness, width: thickness, height: height - 2 * thickness },
    { zone, x: right, y: y + thickness, width: thickness, height: height - 2 * thickness, flipX: true },
  ];
  if (cornerZone) {
    regions.push(
      { zone: cornerZone, x, y, width: thickness, height: thickness },
      { zone: cornerZone, x: right, y, width: thickness, height: thickness, flipX: true },
      { zone: cornerZone, x, y: bottom, width: thickness, height: thickness, flipY: true },
      { zone: cornerZone, x: right, y: bottom, width: thickness, height: thickness, flipX: true, flipY: true },
    );
  }
  return regions;
}

/** Solid lines of `lineWidth` along the four inside edges of `outer`. */
export function outlineRegions(outer: Rect, lineWidth: number, fillSlot: number): Region[] {
  if (lineWidth <= 0) return [];
  const { x, y, width, height } = outer;
  return [
    { fillSlot, x, y, width, height: lineWidth },
    { fillSlot, x, y: y + height - lineWidth, width, height: lineWidth },
    { fillSlot, x, y, width: lineWidth, height },
    { fillSlot, x: x + width - lineWidth, y, width: lineWidth, height },
  ];
}

/** A vertical line centred on `x`. */
export function verticalLine(x: number, top: number, height: number, lineWidth: number, fillSlot: number): Region {
  return { fillSlot, x: x - Math.floor(lineWidth / 2), y: top, width: lineWidth, height };
}
