<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import { RENDER_MODES, RENDER_SCHEMA, type Design } from '../core/design';
  import { MAX_SEED, randomSeed } from '../core/rng';

  /** Render mode, weave and ikat settings, and the seed. */
  let { design = $bindable() }: { design: Design } = $props();

  const REALISTIC_ONLY = new Set(['bleed', 'warpJitter', 'weftJitter', 'texture']);
  const NOT_IN_FLAT = new Set(['sheen', 'light', 'threads']);

  function isDisabled(key: string): boolean {
    if (REALISTIC_ONLY.has(key)) return design.mode !== 'realistic';
    if (NOT_IN_FLAT.has(key)) return design.mode === 'flat';
    return false;
  }

  function setSeed(raw: string) {
    const seed = Math.round(Number(raw));
    if (Number.isFinite(seed)) design.seed = Math.min(MAX_SEED, Math.max(0, seed));
  }
</script>

<PanelSection title="Weave">
  <div class="segmented" role="radiogroup" aria-label="Render mode">
    {#each RENDER_MODES as mode (mode.value)}
      <button
        role="radio"
        aria-checked={design.mode === mode.value}
        title={mode.help}
        onclick={() => (design.mode = mode.value)}>{mode.label}</button
      >
    {/each}
  </div>
  {#each RENDER_SCHEMA as def (def.key)}
    <ParamControl {def} bind:value={design.render[def.key]} disabled={isDisabled(def.key)} />
  {/each}
  <div class="field">
    <label for="seed">Seed</label>
    <div class="button-row nowrap">
      <input
        id="seed"
        type="number"
        min="0"
        max={MAX_SEED}
        value={design.seed}
        onchange={(event) => setSeed(event.currentTarget.value)}
      />
      <button class="button" onclick={() => (design.seed = randomSeed())}>New seed</button>
    </div>
    <p class="help">The seed decides how the threads drift and bleed. The same seed always gives the same cloth.</p>
  </div>
</PanelSection>

<style>
  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .segmented button {
    border: 0;
    background: var(--control);
    padding: 8px 4px;
    min-height: 38px;
  }
  .segmented button + button {
    border-left: 1px solid var(--line);
  }
  .segmented button[aria-checked='true'] {
    background: var(--accent);
    color: var(--accent-text);
  }
</style>
