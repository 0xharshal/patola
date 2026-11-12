<script lang="ts">
  import { onMount } from 'svelte';
  import Viewport from './Viewport.svelte';
  import type { Frame } from '../render/renderer';
  import type { Size } from '../layouts/types';
  import type { Design } from '../core/design';
  import type { Params } from '../core/params';
  import { mulberry32 } from '../core/rng';
  import { cameraAt, gridInterest, planTour } from '../exhibition/tour';
  import { exhibitionSettings, nextDesign } from '../exhibition/settings';
  import { getGenerator } from '../generators/registry';
  import { getLayout, patternOnly } from '../layouts/registry';
  import { getPalette } from '../palettes/presets';

  /**
   * Full-screen slideshow, like an exhibition display: the camera tours each
   * design (whole piece, motifs, threads), then it fades to the next design.
   */
  let {
    design = $bindable(),
    frame,
    pieceThreads,
    threadPx,
    settings,
    onExit,
  }: {
    design: Design;
    frame: Omit<Frame, 'view' | 'background'>;
    pieceThreads: Size;
    threadPx: number;
    settings: Params;
    /** Back to the editor, with the design on show. */
    onExit: () => void;
  } = $props();

  const FADE_SECONDS = 1.5;
  /** Controls and the pointer hide after this long without movement. */
  const IDLE_MS = 3000;
  const MAX_HISTORY = 50;

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

  const tour = $derived(
    planTour({
      piece: pieceThreads,
      viewport,
      pixelRatio,
      closeups: options.closeups,
      random: mulberry32(design.seed + dropped + shown),
      interest: gridInterest(frame.grid, frame.render.step),
    }),
  );
  const camera = $derived(cameraAt(tour, viewport.width, elapsed / options.seconds));
  const opacity = $derived(
    Math.max(0, Math.min(1, elapsed / FADE_SECONDS, (options.seconds - elapsed) / FADE_SECONDS)),
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
      // At most 0.1 s per frame, so a hidden tab doesn't jump ahead when it comes back.
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused) {
        elapsed += seconds;
        if (elapsed >= options.seconds) go(1);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  });

  // Keep the screen on while the exhibition runs (where the browser allows it).
  onMount(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      lock = await navigator.wakeLock.request('screen').catch(() => null);
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => {});
    };
  });

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  function showControls() {
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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onExit();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === ' ') paused = !paused;
    else if (event.key === 'ArrowRight') go(1);
    else if (event.key === 'ArrowLeft') go(-1);
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
      onresize={(size, ratio) => {
        viewport = size;
        pixelRatio = ratio;
      }}
    />
  </div>

  {#if options.captions}
    <div class="caption" class:visible={captionVisible} aria-live="polite">
      <h2>{caption.title}</h2>
      <p class="colours">{caption.colours}</p>
      <p>{caption.about}</p>
    </div>
  {/if}

  <div class="controls" class:visible={controlsVisible || paused} role="toolbar" aria-label="Exhibition">
    <button onclick={() => go(-1)} disabled={shown === 0}>Previous</button>
    <button onclick={() => (paused = !paused)} aria-pressed={paused}>{paused ? 'Play' : 'Pause'}</button>
    <button onclick={() => go(1)}>Next</button>
    {#if document.fullscreenEnabled}
      <button onclick={toggleFullscreen}>{fullscreen ? 'Leave full screen' : 'Full screen'}</button>
    {/if}
    <button onclick={exit} title="Back to the editor with this design">Edit this design</button>
  </div>
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
  .controls button:disabled {
    opacity: 0.4;
  }
</style>
