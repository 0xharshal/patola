<script lang="ts" module>
  /**
   * Pixels rendered per CSS pixel while editing. Capped at 2: on 3× phone screens
   * this draws 2.25× fewer pixels with no visible difference, and the browser
   * scales it up. Pictures only for looking at (wallpaper, exhibition) use every
   * screen pixel; exports render at their own size.
   */
  const MAX_EDITING_PIXEL_RATIO = 2;
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { PatolaRenderer, type Frame } from '../render/renderer';
  import { fitCamera, panBy, viewFor, zoomAt, type Camera, type FitMode } from '../render/camera';
  import type { Rect, Size } from '../layouts/types';

  let {
    frame,
    pieceThreads,
    fitMode = 'contain',
    interactive = true,
    threadPx,
    camera: directedCamera,
    onresize,
    gpu = 'default',
    ongpu,
    draw,
  }: {
    /** Everything to draw except the view, which this component owns. */
    frame: Omit<Frame, 'view' | 'background'>;
    pieceThreads: Size;
    fitMode?: FitMode;
    interactive?: boolean;
    /** Pixels per thread at "100 %". */
    threadPx: number;
    /** Set to steer the view from outside (exhibition); the viewer's own camera is then unused. */
    camera?: Camera;
    /** Called with the viewport size in device pixels, and device pixels per CSS pixel. */
    onresize?: (viewport: Size, pixelRatio: number) => void;
    /** Graphics card to ask for; read once (remount the viewer to switch). */
    gpu?: WebGLPowerPreference;
    /** Called with the name of the graphics card that draws. */
    ongpu?: (name: string) => void;
    /** Draw the frame some other way (exhibition images) instead of rendering the weave. */
    draw?: (renderer: PatolaRenderer, frame: Frame) => void;
  } = $props();

  function renderPixelRatio(): number {
    const screenRatio = window.devicePixelRatio || 1;
    return interactive ? Math.min(screenRatio, MAX_EDITING_PIXEL_RATIO) : screenRatio;
  }

  let stage: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let renderer: PatolaRenderer | null = $state(null);
  let error = $state('');
  let background = $state('#e9e1d2');
  /** Viewport in device pixels. */
  let viewport: Size = $state({ width: 1, height: 1 });
  let camera: Camera = $state({ centreX: 0, centreY: 0, scale: 1 });
  const shownCamera = $derived(directedCamera ?? camera);
  /** True while the camera shows the whole piece; it then follows resizes. */
  let fitted = $state(true);

  const marginPx = $derived(interactive ? 16 * renderPixelRatio() : 0);
  /** Zoom buttons would cover a very short picture (e.g. phone with the controls at full height). */
  const roomForZoomButtons = $derived(viewport.height / renderPixelRatio() >= 180);
  const minScale = $derived(fitCamera({ x: 0, y: 0, ...pieceThreads }, viewport, 'contain').scale * 0.5);

  /** Show `area` (in threads), or the whole piece. */
  export function fit(area: Rect = { x: 0, y: 0, ...pieceThreads }) {
    const whole = area.width === pieceThreads.width && area.height === pieceThreads.height;
    camera = fitCamera(area, viewport, whole ? fitMode : 'contain', marginPx);
    fitted = whole;
  }

  // Refit when the piece changes size or the viewport changes while showing the whole piece.
  let lastPieceKey = '';
  $effect(() => {
    const pieceKey = `${pieceThreads.width}x${pieceThreads.height}`;
    if (pieceKey !== lastPieceKey || fitted) {
      lastPieceKey = pieceKey;
      void viewport.width;
      fit();
    }
  });

  $effect(() => {
    if (!renderer) return;
    const full: Frame = { ...frame, background, view: viewFor(shownCamera, viewport) };
    if (draw) draw(renderer, full);
    else renderer.draw(full);
  });

  function readBackground() {
    const match = getComputedStyle(stage).backgroundColor.match(/\d+/g);
    if (match)
      background =
        '#' +
        match
          .slice(0, 3)
          .map((channel) => Number(channel).toString(16).padStart(2, '0'))
          .join('');
  }

  onMount(() => {
    try {
      renderer = new PatolaRenderer(canvas, gpu);
      ongpu?.(renderer.gpuName());
    } catch (problem) {
      error = problem instanceof Error ? problem.message : String(problem);
    }
    const observer = new ResizeObserver(([entry]) => {
      const dpr = renderPixelRatio();
      viewport = {
        width: Math.max(1, Math.round(entry.contentRect.width * dpr)),
        height: Math.max(1, Math.round(entry.contentRect.height * dpr)),
      };
      onresize?.(viewport, dpr);
    });
    observer.observe(stage);
    readBackground();
    const darkScheme = matchMedia('(prefers-color-scheme: dark)');
    darkScheme.addEventListener('change', readBackground);
    // Non-passive, so the page doesn't scroll while zooming.
    const onWheel = (event: WheelEvent) => {
      if (!interactive) return;
      event.preventDefault();
      const [x, y] = devicePoint(event);
      zoom(Math.exp(-event.deltaY * 0.0015), x, y);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      darkScheme.removeEventListener('change', readBackground);
      canvas.removeEventListener('wheel', onWheel);
      renderer?.dispose();
    };
  });

  function devicePoint(event: { clientX: number; clientY: number }): [number, number] {
    const bounds = canvas.getBoundingClientRect();
    const dpr = renderPixelRatio();
    return [(event.clientX - bounds.left) * dpr, (event.clientY - bounds.top) * dpr];
  }

  function zoom(factor: number, x = viewport.width / 2, y = viewport.height / 2) {
    camera = zoomAt(camera, viewport, factor, x, y, minScale);
    fitted = false;
  }

  // Pointer gestures: one pointer pans, two pointers pinch-zoom (and pan).
  // Plain Map on purpose: pointer positions are gesture bookkeeping, not UI state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pointers = new Map<number, [number, number]>();

  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, devicePoint(event));
  }

  function onPointerMove(event: PointerEvent) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = devicePoint(event);
    if (pointers.size === 1) {
      camera = panBy(camera, current[0] - previous[0], current[1] - previous[1], pieceThreads);
    } else if (pointers.size === 2) {
      const [other] = [...pointers].filter(([id]) => id !== event.pointerId).map(([, point]) => point);
      const distanceBefore = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
      const distanceAfter = Math.hypot(current[0] - other[0], current[1] - other[1]);
      if (distanceBefore > 0) {
        camera = zoomAt(
          camera,
          viewport,
          distanceAfter / distanceBefore,
          (current[0] + other[0]) / 2,
          (current[1] + other[1]) / 2,
          minScale,
        );
        camera = panBy(camera, (current[0] - previous[0]) / 2, (current[1] - previous[1]) / 2, pieceThreads);
      }
    }
    pointers.set(event.pointerId, current);
    fitted = false;
  }

  function onPointerUp(event: PointerEvent) {
    pointers.delete(event.pointerId);
  }
</script>

<div class="stage" class:interactive bind:this={stage}>
  <canvas
    bind:this={canvas}
    aria-label="Rendered patola design. Drag to move, pinch or scroll to zoom, double-click to show everything."
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    ondblclick={() => interactive && fit()}
  ></canvas>
  {#if interactive && roomForZoomButtons}
    <div class="zoom" role="group" aria-label="Zoom">
      <button class="icon-button" onclick={() => zoom(1 / 1.5)} aria-label="Zoom out">−</button>
      <button class="zoom-level" onclick={() => fit()} title="Show the whole piece"
        >{Math.round((camera.scale / threadPx) * 100)} %</button
      >
      <button class="icon-button" onclick={() => zoom(1.5)} aria-label="Zoom in">+</button>
    </div>
  {/if}
  {#if error}
    <p class="error">{error} Try a recent version of Chrome, Firefox, Safari or Edge.</p>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--stage);
    overflow: hidden;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .interactive canvas {
    touch-action: none;
    cursor: grab;
  }
  .interactive canvas:active {
    cursor: grabbing;
  }
  .zoom {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  }
  .zoom .icon-button {
    font-size: 1.1rem;
  }
  .zoom-level {
    min-width: 64px;
    border: 0;
    background: transparent;
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
  }
  .error {
    position: absolute;
    inset: auto 16px 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px;
  }
</style>
