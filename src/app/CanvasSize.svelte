<script lang="ts">
  import { clampSize, MIN_SIZE, type Design } from '../core/design';
  import { maxCanvasSide } from '../core/compose';
  import { CANVAS_PRESETS, presetOf } from '../core/canvasSizes';
  import { patternOnly } from '../layouts/registry';
  import type { Size } from '../layouts/types';

  /**
   * Canvas size of a single pattern: this screen, a ready-made size or a custom one
   * (other pieces get their size from the layout). Also shows the thread count.
   * Part of the design, so it goes into links.
   */
  let {
    design = $bindable(),
    screenPixels,
    pieceThreads,
  }: { design: Design; screenPixels: Size; pieceThreads: Size } = $props();

  const id = $props.id();
  const isPatternOnly = $derived(design.layout === patternOnly.id);
  /** Chosen in the list but not (yet) a preset size. */
  let customChosen = $state(false);
  const choice = $derived(
    design.size === null ? 'screen' : customChosen ? 'custom' : (presetOf(design.size)?.id ?? 'custom'),
  );
  const largest = $derived(maxCanvasSide(design.render));
  const capped = $derived(screenPixels.width > largest || screenPixels.height > largest);

  function choose(value: string) {
    customChosen = value === 'custom';
    if (value === 'screen') design.size = null;
    else if (value === 'custom') design.size = { ...screenPixels };
    else {
      const preset = CANVAS_PRESETS.find((candidate) => candidate.id === value)!;
      design.size = { width: preset.width, height: preset.height };
    }
  }

  function setDimension(key: keyof Size, raw: string) {
    const pixels = Number(raw);
    if (!design.size || !Number.isFinite(pixels) || pixels <= 0) return;
    customChosen = true;
    design.size[key] = clampSize(pixels);
  }

  /** Portrait ↔ landscape. */
  function turn() {
    if (design.size) design.size = { width: design.size.height, height: design.size.width };
  }
</script>

<div class="canvas-size">
  <h3 class="subheading">Canvas size</h3>
  {#if isPatternOnly}
    <div class="field">
      <label for={id}>Canvas</label>
      <select {id} value={choice} onchange={(event) => choose(event.currentTarget.value)}>
        <option value="screen">This screen</option>
        {#each CANVAS_PRESETS as preset (preset.id)}
          <option value={preset.id}>{preset.label} ({preset.width} × {preset.height})</option>
        {/each}
        <option value="custom">Custom size</option>
      </select>
    </div>
    <div class="button-row nowrap dimensions">
      {#each ['width', 'height'] as const as dimension (dimension)}
        <label class="field">
          {dimension === 'width' ? 'Width (px)' : 'Height (px)'}
          <input
            type="number"
            min={MIN_SIZE}
            max={largest}
            value={screenPixels[dimension]}
            disabled={!design.size}
            onchange={(event) => setDimension(dimension, event.currentTarget.value)}
          />
        </label>
      {/each}
      <button
        class="icon-button"
        disabled={!design.size}
        onclick={turn}
        title="Swap width and height (portrait / landscape)"
        aria-label="Swap width and height">⇄</button
      >
    </div>
    {#if capped}
      <p class="help">
        At this thread size the canvas can be at most {largest.toLocaleString()} px a side. Use a larger thread size (Weave),
        or keep this size and export larger.
      </p>
    {/if}
  {/if}
  <p class="help">
    {#if !isPatternOnly}The layout sets the size of this piece.{/if}
    {pieceThreads.width.toLocaleString()} × {pieceThreads.height.toLocaleString()} threads. Choose the image size when exporting.
  </p>
</div>

<style>
  .canvas-size {
    display: grid;
    gap: 14px;
  }
  .dimensions {
    align-items: end;
  }
</style>
