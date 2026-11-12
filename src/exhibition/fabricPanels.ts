/**
 * The panels of the endless fabric on the GPU: each panel's design is composed
 * and rendered into an image once, a little ahead of where the cloth is going,
 * and forgotten once it has passed.
 */
import { compose } from '../core/compose';
import { renderSettings, type Design } from '../core/design';
import type { Frame, PatolaRenderer, RenderedImage, View } from '../render/renderer';
import type { Size } from '../layouts/types';
import type { ExhibitionSettings } from './settings';
import { panelDesign, panelsIn } from './fabric';

/** Pixels of upcoming panels to render per frame: small enough not to slow the frame down. */
const PREPARE_PIXELS_PER_FRAME = 600_000;

interface Panel {
  design: Design;
  frame: Omit<Frame, 'view' | 'background'>;
  image: RenderedImage;
}

const keyOf = (column: number, row: number) => `${column},${row}`;

export class FabricPanels {
  private panels = new Map<string, Panel>();

  /** `panel`: size in threads; `scale`: pixels per thread the panels are rendered (and shown) at. */
  constructor(
    readonly renderer: PatolaRenderer,
    private base: Design,
    private vary: ExhibitionSettings['vary'],
    /** The exhibition's seed: which designs the panels get. */
    private seed: number,
    readonly panel: Size,
    readonly scale: number,
  ) {}

  /**
   * Draw the view (in fabric threads). `upcoming`: views the cloth will reach
   * soon, nearest first, so their panels are prepared in time.
   */
  draw(view: View, background: string, upcoming: View[]): void {
    const panelsOf = (seen: View) =>
      panelsIn(seen.originX, seen.originY, seen.width / seen.scale, seen.height / seen.scale, this.panel);
    const visible = panelsOf(view);
    const keep = new Set(visible.map(([column, row]) => keyOf(column, row)));
    const ahead: [number, number][] = [];
    for (const [column, row] of upcoming.flatMap(panelsOf)) {
      if (keep.has(keyOf(column, row))) continue;
      keep.add(keyOf(column, row));
      ahead.push([column, row]);
    }

    this.renderer.clear(view, background);
    for (const [column, row] of visible) {
      // Normally prepared ahead; rendered right now only if it wasn't (e.g. at the start).
      const panel = this.panelAt(column, row);
      this.render(panel, Infinity);
      this.renderer.drawImage(panel.image, view, 1, { x: column * this.panel.width, y: row * this.panel.height });
    }
    this.prepareAhead(ahead);

    for (const [key, panel] of this.panels) {
      if (keep.has(key)) continue;
      this.renderer.deleteImage(panel.image);
      this.panels.delete(key);
    }
  }

  /**
   * A little work per frame, so no frame is slow: start one new panel (compose its
   * design), or render part of the next ones, stopping once one completes (its
   * mipmaps take a moment too).
   */
  private prepareAhead(ahead: [number, number][]): void {
    let budget = PREPARE_PIXELS_PER_FRAME;
    for (const [column, row] of ahead) {
      const panel = this.panels.get(keyOf(column, row));
      if (!panel || !this.renderer.isImageValid(panel.image)) {
        this.create(column, row);
        return;
      }
      const { image } = panel;
      if (image.rowsDone >= image.height) continue;
      const rowsBefore = image.rowsDone;
      if (this.render(panel, budget)) return;
      budget -= (image.rowsDone - rowsBefore) * image.width;
      if (budget <= 0) return;
    }
  }

  /** Design of the panel at a fabric position (threads). */
  designAt(x: number, y: number): Design {
    const [column, row] = [Math.floor(x / this.panel.width), Math.floor(y / this.panel.height)];
    return panelDesign(this.base, this.vary, column, row, this.seed);
  }

  private panelAt(column: number, row: number): Panel {
    const panel = this.panels.get(keyOf(column, row));
    return panel && this.renderer.isImageValid(panel.image) ? panel : this.create(column, row);
  }

  /** Render up to `maxPixels` more of a panel; true once it is complete. */
  private render(panel: Panel, maxPixels: number): boolean {
    // Each panel has a lamp of its own, like a piece of cloth under its own light.
    return this.renderer.renderImage(
      panel.image,
      { ...panel.frame, background: '#000000', lightArea: panel.image.area },
      maxPixels,
    );
  }

  /** Compose a panel's design and set up its (empty) image. */
  private create(column: number, row: number): Panel {
    const design = panelDesign(this.base, this.vary, column, row, this.seed);
    const render = renderSettings(design.render);
    // "Pattern only" fills the pixel size it is given: one panel, at the design's thread size.
    const composition = compose(design, {
      width: this.panel.width * render.threadPx,
      height: this.panel.height * render.threadPx,
    });
    const frame = {
      grid: composition.grid,
      warpHorizontal: composition.layout.warpHorizontal,
      palette: design.palette,
      mode: design.mode,
      render,
      seed: design.seed,
    };
    // Shown at exactly the size it is rendered, so no mipmaps.
    const image = this.renderer.createImage(
      { x: 0, y: 0, ...this.panel },
      Math.max(1, Math.round(this.panel.width * this.scale)),
      Math.max(1, Math.round(this.panel.height * this.scale)),
      false,
    );
    const panel = { design, frame, image };
    this.panels.set(keyOf(column, row), panel);
    return panel;
  }

  dispose(): void {
    for (const panel of this.panels.values()) this.renderer.deleteImage(panel.image);
    this.panels.clear();
  }
}
