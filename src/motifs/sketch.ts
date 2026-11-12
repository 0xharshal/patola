/**
 * Draw motifs from simple shapes (discs, rings, arcs, strokes, polygons) on a
 * grid of palette slots, at any size. Shapes are given in design units; `unit`
 * is the number of cells per design unit. A cell is painted when its centre lies
 * inside the shape, giving the stepped edges of tied threads. Strokes stay at
 * least one cell wide, so small motifs keep their lines.
 */
import { SLOT } from '../generators/types';
import type { MotifGrid } from './format';

type Point = readonly [number, number];

/** Degrees to radians; angles run clockwise from the right, as y points down. */
const radians = (degrees: number) => (degrees * Math.PI) / 180;

function distanceToSegment([x, y]: Point, [x0, y0]: Point, [x1, y1]: Point): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / lengthSquared));
  return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
}

function insidePolygon([x, y]: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether `angle` (degrees) lies on the clockwise sweep from `from` to `to`. */
function withinSweep(angle: number, from: number, to: number): boolean {
  const sweep = (((to - from) % 360) + 360) % 360 || 360;
  return (((angle - from) % 360) + 360) % 360 <= sweep;
}

export class MotifSketch {
  readonly slots: Uint8Array;
  /** Size in cells. */
  readonly width: number;
  readonly height: number;

  /** A sketch of designWidth × designHeight design units, at `unit` cells per unit. */
  constructor(
    designWidth: number,
    designHeight: number,
    readonly unit = 1,
  ) {
    this.width = Math.max(1, Math.round(designWidth * unit));
    this.height = Math.max(1, Math.round(designHeight * unit));
    this.slots = new Uint8Array(this.width * this.height);
  }

  /** Paint `slot` wherever `inside(cell centre, in design units)` holds. */
  fill(slot: number, inside: (point: Point) => boolean): this {
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (inside([(x + 0.5) / this.unit, (y + 0.5) / this.unit])) this.slots[y * this.width + x] = slot;
    return this;
  }

  /** Half a stroke's width in design units, at least half a cell. */
  private halfStroke(width: number): number {
    return Math.max(width / 2, 0.5 / this.unit);
  }

  rect(left: number, top: number, right: number, bottom: number, slot: number): this {
    return this.fill(slot, ([x, y]) => x >= left && x <= right && y >= top && y <= bottom);
  }

  disc(centre: Point, radius: number, slot: number): this {
    return this.fill(slot, ([x, y]) => Math.hypot(x - centre[0], y - centre[1]) <= radius);
  }

  ring(centre: Point, inner: number, outer: number, slot: number): this {
    const thinnest = Math.max(outer - inner, 1 / this.unit); // at least a cell wide
    return this.fill(slot, ([x, y]) => {
      const distance = Math.hypot(x - centre[0], y - centre[1]);
      return distance >= outer - thinnest && distance <= outer;
    });
  }

  /** Union of discs along a quadratic curve, their radius going from `startRadius` to `endRadius`. */
  sweep(start: Point, control: Point, end: Point, startRadius: number, endRadius: number, slot: number): this {
    const discs = Array.from({ length: 101 }, (_, step) => {
      const t = step / 100;
      const [a, b, c] = [(1 - t) ** 2, 2 * (1 - t) * t, t * t];
      return {
        x: a * start[0] + b * control[0] + c * end[0],
        y: a * start[1] + b * control[1] + c * end[1],
        radius: startRadius + (endRadius - startRadius) * t,
      };
    });
    return this.fill(slot, ([x, y]) => discs.some((disc) => Math.hypot(x - disc.x, y - disc.y) <= disc.radius));
  }

  ellipse(centre: Point, radiusX: number, radiusY: number, slot: number): this {
    return this.fill(slot, ([x, y]) => ((x - centre[0]) / radiusX) ** 2 + ((y - centre[1]) / radiusY) ** 2 <= 1);
  }

  /** A straight stroke `width` cells wide. */
  line(from: Point, to: Point, width: number, slot: number): this {
    const half = this.halfStroke(width);
    return this.fill(slot, (point) => distanceToSegment(point, from, to) <= half);
  }

  /** A curved stroke along a circle, clockwise from `fromDegrees` to `toDegrees` (0 = right, 90 = down). */
  arc(centre: Point, radius: number, fromDegrees: number, toDegrees: number, width: number, slot: number): this {
    const half = this.halfStroke(width);
    return this.fill(slot, ([x, y]) => {
      const distance = Math.hypot(x - centre[0], y - centre[1]);
      if (Math.abs(distance - radius) > half) return false;
      const angle = (Math.atan2(y - centre[1], x - centre[0]) * 180) / Math.PI;
      return withinSweep(angle, fromDegrees, toDegrees);
    });
  }

  polygon(points: readonly Point[], slot: number): this {
    return this.fill(slot, (point) => insidePolygon(point, points));
  }

  /** `count` spokes from `inner` to `outer` radius, the first at `startDegrees`. */
  spokes(
    centre: Point,
    inner: number,
    outer: number,
    count: number,
    width: number,
    slot: number,
    startDegrees = 0,
  ): this {
    for (let spoke = 0; spoke < count; spoke++) {
      const angle = radians(startDegrees + (360 * spoke) / count);
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      this.line(
        [centre[0] + cos * inner, centre[1] + sin * inner],
        [centre[0] + cos * outer, centre[1] + sin * outer],
        width,
        slot,
      );
    }
    return this;
  }

  /** Point on a circle at `degrees` (0 = right, 90 = down). */
  static onCircle(centre: Point, radius: number, degrees: number): Point {
    return [centre[0] + Math.cos(radians(degrees)) * radius, centre[1] + Math.sin(radians(degrees)) * radius];
  }

  /**
   * Dark contour around the motif: ground cells outside it (reachable from the
   * edge) that touch a painted cell sideways or up/down. Enclosed ground, such
   * as between a wheel's spokes, stays plain.
   */
  outline(): this {
    const { width, height, slots } = this;
    const outside = new Uint8Array(width * height);
    const queue: number[] = [];
    for (let index = 0; index < slots.length; index++) {
      const [x, y] = [index % width, Math.floor(index / width)];
      if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && slots[index] === SLOT.ground) {
        outside[index] = 1;
        queue.push(index);
      }
    }
    while (queue.length > 0) {
      const index = queue.pop()!;
      const [x, y] = [index % width, Math.floor(index / width)];
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || outside[next] || slots[next] !== SLOT.ground) continue;
        outside[next] = 1;
        queue.push(next);
      }
    }
    const painted = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < width && y < height && slots[y * width + x] !== SLOT.ground;
    const contour: number[] = [];
    for (let index = 0; index < slots.length; index++) {
      const [x, y] = [index % width, Math.floor(index / width)];
      if (outside[index] && (painted(x - 1, y) || painted(x + 1, y) || painted(x, y - 1) || painted(x, y + 1)))
        contour.push(index);
    }
    for (const index of contour) slots[index] = SLOT.outline;
    return this;
  }

  grid(): MotifGrid {
    return { width: this.width, height: this.height, slots: this.slots };
  }
}
