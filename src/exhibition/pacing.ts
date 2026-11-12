/**
 * Frame pacing for the exhibition: on which display refreshes to draw, so the
 * picture moves at a chosen rate on any display (60, 120, 144, 165 Hz …).
 */

/** Display refreshes may arrive this much (ms) before their slot: their timestamps jitter. */
const SLACK_MS = 2;

export class FramePacer {
  private nextDraw = -Infinity;

  /** `framesPerSecond`: Infinity draws on every display refresh. */
  constructor(private readonly framesPerSecond: number) {}

  /** Whether to draw on the display refresh at `now` (ms). */
  shouldDraw(now: number): boolean {
    if (!Number.isFinite(this.framesPerSecond)) return true;
    if (now < this.nextDraw - SLACK_MS) return false;
    const interval = 1000 / this.framesPerSecond;
    // Keep to the schedule (no drift); after a stall, e.g. a hidden tab, start afresh.
    this.nextDraw = now - this.nextDraw > interval ? now + interval : this.nextDraw + interval;
    return true;
  }
}

/** The display's refresh rate (per second), measured over `frames` animation frames. */
export function measureRefreshRate(frames = 40): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = [];
    const step = (now: number) => {
      times.push(now);
      if (times.length <= frames) return void requestAnimationFrame(step);
      const gaps = times
        .slice(1)
        .map((time, index) => time - times[index])
        .sort((a, b) => a - b);
      resolve(Math.round(1000 / gaps[Math.floor(gaps.length / 2)]));
    };
    requestAnimationFrame(step);
  });
}

/** Pixels of upcoming tour images rendered per second, spread over the frames (600,000 a frame at 30 fps). */
export const TOUR_PREPARATION_RATE = 18_000_000;

/**
 * How much preparation work (pixels) a frame may do: the same amount per second
 * whatever the frame rate, so high refresh rates don't multiply the work.
 */
export class PreparationBudget {
  private lastFrame: number | null = null;

  constructor(private readonly pixelsPerSecond: number) {}

  /** Pixels for the frame drawn at `now` (ms); at most a tenth of a second's worth after a pause. */
  forFrame(now = performance.now()): number {
    const seconds = this.lastFrame === null ? 1 / 30 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    return Math.max(1, this.pixelsPerSecond * seconds);
  }
}
