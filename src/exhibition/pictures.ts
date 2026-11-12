/**
 * Image mode of the exhibition: shows each stretch of the tour from one
 * prerendered high-resolution image (see planImages) instead of rendering the
 * weave for every frame. The next image is prepared a little per frame, ahead
 * of time; consecutive images crossfade.
 */
import type { Frame, PatolaRenderer, RenderedImage } from '../render/renderer';
import type { Rect } from '../layouts/types';
import type { TourImage } from './tour';
import { PreparationBudget, TOUR_PREPARATION_RATE } from './pacing';

/** Crossfade between consecutive images, in seconds. */
const CROSSFADE_SECONDS = 0.6;

export class TourPictures {
  private images = new Map<TourImage, RenderedImage>();
  private budget = new PreparationBudget(TOUR_PREPARATION_RATE);

  constructor(readonly renderer: PatolaRenderer) {}

  /**
   * Draw the frame at `progress` (0…1) of a tour lasting `seconds`, whose images
   * are `plan`. `lightArea`: one lamp for the whole tour, so images match.
   */
  draw(frame: Frame, plan: TourImage[], progress: number, seconds: number, lightArea: Rect): void {
    const index = Math.max(
      0,
      plan.findIndex((image) => progress <= image.to),
    );
    const weave = { ...frame, lightArea };
    const current = this.prepare(plan[index], weave, Infinity)!;
    const previous = index > 0 ? this.images.get(plan[index - 1]) : undefined;
    // Crossfade: the new image covers the whole view; the old one fades out on top where it reaches.
    const fade = Math.min(1, ((progress - plan[index].from) * seconds) / CROSSFADE_SECONDS);

    this.renderer.clear(frame.view, frame.background);
    this.renderer.drawImage(current, frame.view);
    if (previous && fade < 1 && previous.rowsDone >= previous.height)
      this.renderer.drawImage(previous, frame.view, 1 - fade);

    const budget = this.budget.forFrame();
    if (index + 1 < plan.length) this.prepare(plan[index + 1], weave, budget);
    this.forgetAllBut(plan.slice(Math.max(0, index - 1), index + 2));
  }

  /** The image for `planned`, rendering up to `maxPixels` more of it. */
  private prepare(planned: TourImage, frame: Frame, maxPixels: number): RenderedImage | undefined {
    let image = this.images.get(planned);
    if (image && !this.renderer.isImageValid(image)) {
      this.images.delete(planned);
      image = undefined;
    }
    if (!image) {
      // Within the GPU's limit, at the planned sharpness where possible.
      const largest = this.renderer.maxImageSide();
      const scale = Math.min(planned.scale, largest / planned.area.width, largest / planned.area.height);
      image = this.renderer.createImage(
        planned.area,
        Math.max(1, Math.round(planned.area.width * scale)),
        Math.max(1, Math.round(planned.area.height * scale)),
      );
      this.images.set(planned, image);
    }
    this.renderer.renderImage(image, frame, maxPixels);
    return image;
  }

  private forgetAllBut(keep: TourImage[]): void {
    for (const [planned, image] of this.images) {
      if (keep.includes(planned)) continue;
      this.renderer.deleteImage(image);
      this.images.delete(planned);
    }
  }

  /** Free every image (when the exhibition ends). */
  dispose(): void {
    this.forgetAllBut([]);
  }
}
