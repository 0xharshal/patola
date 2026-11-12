<script lang="ts">
  import PanelSection from './PanelSection.svelte';
  import { clampSize, MAX_SIZE, MIN_SIZE, type Design } from '../core/design';
  import { patternOnly } from '../layouts/registry';
  import type { Size } from '../layouts/types';

  /** Pixel size of a single pattern (other pieces get their size from the layout), and the thread count. */
  let {
    design = $bindable(),
    screenPixels,
    pieceThreads,
  }: { design: Design; screenPixels: Size; pieceThreads: Size } = $props();

  const isPatternOnly = $derived(design.layout === patternOnly.id);

  function setDimension(key: keyof Size, raw: string) {
    const pixels = Number(raw);
    if (design.size && Number.isFinite(pixels) && pixels > 0) design.size[key] = clampSize(pixels);
  }
</script>

<PanelSection title="Size" open={false}>
  {#if isPatternOnly}
    <label class="check">
      <input
        type="checkbox"
        checked={design.size === null}
        onchange={(event) => (design.size = event.currentTarget.checked ? null : { ...screenPixels })}
      />
      Match this screen
    </label>
    <div class="button-row nowrap">
      {#each ['width', 'height'] as const as dimension (dimension)}
        <label class="field">
          {dimension === 'width' ? 'Width' : 'Height'}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={screenPixels[dimension]}
            disabled={!design.size}
            onchange={(event) => setDimension(dimension, event.currentTarget.value)}
          />
        </label>
      {/each}
    </div>
  {/if}
  <p class="help">
    {pieceThreads.width.toLocaleString()} × {pieceThreads.height.toLocaleString()} threads. Choose the image size when exporting.
  </p>
</PanelSection>

<style>
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .check input {
    width: 18px;
    height: 18px;
  }
</style>
