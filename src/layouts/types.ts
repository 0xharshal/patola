import type { ParamSchema, ParamValues, Params } from '../core/params';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

/**
 * A rectangle of the piece, in design cells. It is either painted with a zone's
 * pattern or filled with one palette slot (dividing lines, zari lines).
 */
export interface Region extends Rect {
  zone?: string;
  fillSlot?: number;
  /** Mirror the zone's pattern, e.g. so a bottom border faces the body like the top one. */
  flipX?: boolean;
  flipY?: boolean;
}

/** The pattern chosen for one zone. */
export interface ZoneFill {
  generator: string;
  params: Params;
}

export interface ZoneDef {
  id: string;
  name: string;
  about: string;
  /** Default pattern for this zone (params are overrides of the generator defaults). */
  fill: { generator: string; params?: Params };
}

/** Every layout has a body zone; its pattern lives in Design.generator / Design.params. */
export const BODY_ZONE = 'body';

/** Declare layouts with `defineLayout` so `size` and `regions` get typed settings. */
export interface LayoutDef<Schema extends ParamSchema = ParamSchema> {
  id: string;
  name: string;
  about: string;
  /** Proportions and counts of the piece. */
  settings: Schema;
  body: Omit<ZoneDef, 'id' | 'fill'> & { fill?: ZoneDef['fill'] };
  zones: ZoneDef[];
  /** Saree-like pieces are shown lengthwise, so their warp runs horizontally. */
  warpHorizontal: boolean;
  /** Piece size in cells. `screenSize` is the size that fills the requested pixel size. */
  size(settings: ParamValues<Schema>, screenSize: Size): Size;
  regions(settings: ParamValues<Schema>, size: Size): Region[];
}

export function defineLayout<const Schema extends ParamSchema>(layout: LayoutDef<Schema>): LayoutDef<Schema> {
  return layout;
}
