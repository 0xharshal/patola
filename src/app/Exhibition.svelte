<script lang="ts">
  import { onMount } from 'svelte';
  import Viewport from './Viewport.svelte';
  import type { Frame } from '../render/renderer';
  import type { Size } from '../layouts/types';
  import type { Design } from '../core/design';
  import type { Params } from '../core/params';
  import { mulberry32 } from '../core/rng';
  import { cameraAt, gridInterest, planImages, planTour } from '../exhibition/tour';
  import { TourPictures } from '../exhibition/pictures';
  import type { PatolaRenderer } from '../render/renderer';
  import { exhibitionSettings, nextDesign } from '../exhibition/settings';
  import { fabricCentre, fabricSpeed, panelSize } from '../exhibition/fabric';
  import { FabricPanels } from '../exhibition/fabricPanels';
  import { viewFor, type Camera } from '../render/camera';
  import { getGenerator } from '../generators/registry';
  import { getLayout, patternOnly } from '../layouts/registry';
  import { getPalette } from '../palettes/presets';

  /**
   * Full-screen slideshow, like an exhibition display. Gallery style: the camera
   * tours each design (whole piece, motifs, threads), then it fades to the next.
   * Fabric style: an endless patchwork of designs glides past.
   */
  let {
    design = $bindable(),
    frame,
    pieceThreads,
    threadPx,
    settings,
    gpu,
    fps,
    drawing,
    onExit,
  }: {
    design: Design;
    frame: Omit<Frame, 'view' | 'background'>;
    pieceThreads: Size;
    threadPx: number;
    settings: Params;
    /** Graphics card to ask for. */
    gpu: WebGLPowerPreference;
    /** Redraws per second. */
    fps: number;
    /** Show prerendered images of the tour, or render every frame. */
    drawing: 'images' | 'live';
    /** Back to the editor, with the design on show. */
    onExit: () => void;
  } = $props();

  const FADE_SECONDS = 1.5;
  /** Controls and the pointer hide after this long without movement. */
  const IDLE_MS = 3000;
  const MAX_HISTORY = 50;
  /** Endless fabric: CSS pixels per thread, close enough to see the weave and wide enough for whole motifs. */
  const FABRIC_SCALE = 3;
  /** Endless fabric: how far ahead (seconds) panels are prepared, nearest first. */
  const FABRIC_LOOKAHEAD_SECONDS = [2, 5, 9, 14];

  const options = $derived(exhibitionSettings(settings));
  let viewport: Size = $state({ width: 1, height: 1 });
  let pixelRatio = $state(1);
  /** Seconds into the current design. */
  let elapsed = $state(0);
  let paused = $state(false);
  let controlsVisible = $state(true);
  let fullscreen = $state(Boolean(document.fullscreenElement));

  /** Designs shown so far (as JSON) for going back; `shown` is the current one. */
  const shownDesigns = [JSON.stringify(design)];
  let shown = $state(0);
  /** Designs dropped from the start of a full history: `dropped + shown` numbers designs without repeats. */
  let dropped = $state(0);

  const isFabric = $derived(options.style === 'fabric');

  // The camera tour of one design at a time (the endless fabric has its own path).
  const tour = $derived(
    isFabric
      ? []
      : planTour({
          piece: pieceThreads,
          viewport,
          pixelRatio,
          closeups: options.closeups,
          seconds: options.seconds,
          random: mulberry32(design.seed + dropped + shown),
          interest: gridInterest(frame.grid, frame.render.step),
        }),
  );
  const imagePlan = $derived(
    drawing === 'images' && !isFabric ? planImages(tour, pieceThreads, viewport, options.seconds) : [],
  );
  let pictures: TourPictures | null = null;

  function drawPictures(renderer: PatolaRenderer, shown: Frame) {
    if (pictures?.renderer !== renderer) {
      pictures?.dispose();
      pictures = new TourPictures(renderer);
    }
    // One lamp over the opening view for the whole tour, so the images match each other.
    const progress = Math.min(1, elapsed / options.seconds);
    pictures.draw(shown, imagePlan, progress, options.seconds, imagePlan[0].area);
  }

  // Endless fabric: panels of single-pattern designs around the one on show, gliding by.
  const fabricBase: Design = JSON.parse(JSON.stringify(design));
  const fabricScale = $derived(FABRIC_SCALE * pixelRatio);
  const fabricPanel = $derived(panelSize(viewport, fabricScale, frame.render.step));
  const fabricThreadsPerSecond = $derived(fabricSpeed(viewport, fabricScale));
  let panels: FabricPanels | null = null;

  function fabricCamera(seconds: number): Camera {
    const [centreX, centreY] = fabricCentre(seconds, fabricThreadsPerSecond, fabricBase.seed);
    // Start in the middle of the first panel (the design on show).
    return { centreX: centreX + fabricPanel / 2, centreY: centreY + fabricPanel / 2, scale: fabricScale };
  }

  function drawFabric(renderer: PatolaRenderer, shown: Frame) {
    if (panels?.renderer !== renderer || panels.panel !== fabricPanel || panels.scale !== fabricScale) {
      panels?.dispose();
      panels = new FabricPanels(renderer, fabricBase, options.vary, fabricPanel, fabricScale);
    }
    // Where the cloth will be in the next seconds (turns included), so those panels get prepared.
    const upcoming = FABRIC_LOOKAHEAD_SECONDS.map((ahead) => viewFor(fabricCamera(elapsed + ahead), viewport));
    panels.draw(shown.view, shown.background, upcoming);
  }
  onMount(() => () => {
    pictures?.dispose();
    panels?.dispose();
  });

  const camera = $derived(
    isFabric ? fabricCamera(elapsed) : cameraAt(tour, pieceThreads, viewport, elapsed / options.seconds),
  );
  const opacity = $derived(
    Math.max(0, Math.min(1, elapsed / FADE_SECONDS, isFabric ? 1 : (options.seconds - elapsed) / FADE_SECONDS)),
  );

  const caption = $derived.by(() => {
    const generator = getGenerator(design.generator);
    const layout = getLayout(design.layout);
    const palette = design.paletteId ? getPalette(design.paletteId) : undefined;
    return {
      title: layout.id === patternOnly.id ? generator.name : `${generator.name} ${layout.name.toLowerCase()}`,
      colours: `Colours: ${palette ? palette.name : 'own choice'}`,
      about: generator.about,
    };
  });
  /** Captions show while the whole piece is in view. */
  const captionVisible = $derived(elapsed > 2 && elapsed < Math.min(options.seconds * 0.3, 20));

  /** Show the next (1) or previous (-1) design. */
  function go(step: 1 | -1) {
    if (step < 0 && shown === 0) {
      elapsed = 0;
      return;
    }
    if (step > 0 && shown === shownDesigns.length - 1) {
      shownDesigns.push(
        JSON.stringify(nextDesign(design, options.vary, mulberry32(design.seed * 31 + dropped + shown + 1))),
      );
      if (shownDesigns.length > MAX_HISTORY) {
        shownDesigns.shift();
        shown--;
        dropped++;
      }
    }
    shown += step;
    design = JSON.parse(shownDesigns[shown]);
    elapsed = 0;
  }

  onMount(() => {
    let last = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick);
      // Draw only as often as the frame rate asks (a little early is fine: screens refresh at their own pace).
      if (now - last < 1000 / fps - 4) return;
      // At most 0.1 s per frame, so a hidden tab doesn't jump ahead when it comes back.
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused) {
        elapsed += seconds;
        if (!isFabric && elapsed >= options.seconds) go(1);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  });

  /**
   * Keep the screen on while the exhibition runs. Browsers allow it only on secure
   * pages (https or localhost) and drop it when the page is hidden, so it is asked
   * for again when the page shows or is touched; `screenStaysOn` tells the viewer.
   */
  let screenStaysOn: boolean | null = $state(null);
  let wakeLock: WakeLockSentinel | null = null;
  async function keepScreenOn() {
    if (document.visibilityState !== 'visible' || (wakeLock && !wakeLock.released)) return;
    if (!('wakeLock' in navigator)) {
      screenStaysOn = false;
      return;
    }
    wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
    screenStaysOn = wakeLock !== null;
  }
  onMount(() => {
    void keepScreenOn();
    document.addEventListener('visibilitychange', keepScreenOn);
    return () => {
      document.removeEventListener('visibilitychange', keepScreenOn);
      void wakeLock?.release().catch(() => {});
    };
  });

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  function showControls() {
    void keepScreenOn();
    controlsVisible = true;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => (controlsVisible = false), IDLE_MS);
  }
  onMount(() => {
    showControls();
    const onFullscreenChange = () => (fullscreen = Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      clearTimeout(idleTimer);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  });

  function toggleFullscreen() {
    const change = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    change.catch(() => {});
  }

  function exit() {
    // Endless fabric: edit the design in the middle of the screen.
    if (isFabric && panels) design = panels.designAt(camera.centreX, camera.centreY);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onExit();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === ' ') paused = !paused;
    else if (event.key === 'ArrowRight' && !isFabric) go(1);
    else if (event.key === 'ArrowLeft' && !isFabric) go(-1);
    else if (event.key === 'f') toggleFullscreen();
    // In full screen the browser takes Escape to leave full screen first.
    else if (event.key === 'Escape') exit();
    else return;
    event.preventDefault();
    showControls();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="exhibition"
  class:idle={!controlsVisible}
  role="presentation"
  onpointermove={showControls}
  onpointerdown={showControls}
>
  <div class="picture" style:opacity>
    <Viewport
      {frame}
      {pieceThreads}
      {threadPx}
      interactive={false}
      {camera}
      {gpu}
      draw={isFabric ? drawFabric : drawing === 'images' ? drawPictures : undefined}
      onresize={(size, ratio) => {
        viewport = size;
        pixelRatio = ratio;
      }}
    />
  </div>

  {#if options.captions && !isFabric}
    <div class="caption" class:visible={captionVisible} aria-live="polite">
      <h2>{caption.title}</h2>
      <p class="colours">{caption.colours}</p>
      <p>{caption.about}</p>
    </div>
  {/if}

  <div class="controls" class:visible={controlsVisible || paused} role="toolbar" aria-label="Exhibition">
    {#if !isFabric}
      <button onclick={() => go(-1)} disabled={shown === 0}>Previous</button>
    {/if}
    <button onclick={() => (paused = !paused)} aria-pressed={paused}>{paused ? 'Play' : 'Pause'}</button>
    {#if !isFabric}
      <button onclick={() => go(1)}>Next</button>
    {/if}
    {#if document.fullscreenEnabled}
      <button onclick={toggleFullscreen}>{fullscreen ? 'Leave full screen' : 'Full screen'}</button>
    {/if}
    <button onclick={exit} title="Back to the editor with this design">Edit this design</button>
  </div>
  {#if screenStaysOn === false}
    <p class="warning" class:visible={controlsVisible || paused}>
      {window.isSecureContext
        ? 'This browser may let the screen turn off during the exhibition.'
        : 'The screen may turn off: browsers keep it on only for secure (https://) pages.'}
    </p>
  {/if}
</div>

<style>
  .exhibition {
    --stage: #0c0b0a;
    position: fixed;
    inset: 0;
    background: var(--stage);
    color: #f1ebe0;
  }
  .exhibition.idle {
    cursor: none;
  }
  .picture {
    position: absolute;
    inset: 0;
  }
  .caption {
    position: absolute;
    left: max(24px, 4vw);
    bottom: max(24px, 5vh);
    max-width: min(560px, calc(100vw - 48px));
    padding: 18px 22px;
    border-radius: 6px;
    background: rgb(12 11 10 / 0.72);
    backdrop-filter: blur(6px);
    opacity: 0;
    transition: opacity 1.2s ease;
    pointer-events: none;
  }
  .caption.visible {
    opacity: 1;
  }
  .caption h2 {
    margin: 0 0 4px;
    font-size: clamp(1.1rem, 1.6vw, 1.8rem);
    font-weight: 600;
  }
  .caption p {
    margin: 6px 0 0;
    font-size: clamp(0.85rem, 1vw, 1.1rem);
    line-height: 1.45;
    color: #d8d0c2;
  }
  .caption .colours {
    color: #b3a995;
  }
  .controls {
    position: absolute;
    top: 16px;
    left: 50%;
    translate: -50% 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    width: max-content;
    max-width: calc(100vw - 32px);
    padding: 6px;
    border-radius: 999px;
    background: rgb(12 11 10 / 0.72);
    backdrop-filter: blur(6px);
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }
  .controls.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .controls button {
    padding: 8px 14px;
    border: 1px solid rgb(255 255 255 / 0.18);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.9rem;
  }
  .controls button:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.12);
  }
  .warning {
    position: absolute;
    top: 72px;
    left: 50%;
    translate: -50% 0;
    width: max-content;
    max-width: calc(100vw - 32px);
    margin: 0;
    padding: 6px 14px;
    border-radius: 6px;
    background: rgb(12 11 10 / 0.72);
    text-align: center;
    font-size: 0.85rem;
    color: #e8c37a;
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }
  .warning.visible {
    opacity: 1;
  }
  .controls button:disabled {
    opacity: 0.4;
  }
</style>
