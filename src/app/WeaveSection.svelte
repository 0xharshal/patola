<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import { RENDER_MODES, RENDER_SCHEMA, type Design } from '../core/design';

  /** Render mode, weave and ikat settings. */
  let { design = $bindable() }: { design: Design } = $props();

  const REALISTIC_ONLY = new Set(['bleed', 'warpJitter', 'weftJitter', 'texture']);
  const NOT_IN_FLAT = new Set(['sheen', 'light', 'threads']);

  function isDisabled(key: string): boolean {
    if (REALISTIC_ONLY.has(key)) return design.mode !== 'realistic';
    if (NOT_IN_FLAT.has(key)) return design.mode === 'flat';
    return false;
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
