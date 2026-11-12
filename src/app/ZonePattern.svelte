<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import MotifPicker from './MotifPicker.svelte';
  import { GENERATORS, getGenerator } from '../generators/registry';
  import { setZoneGenerator } from '../core/design';
  import type { ZoneFill } from '../layouts/types';
  import { ONE_MOTIF_KEYS } from '../generators/commonParams';

  /** Pattern choice and settings for one zone. */
  let {
    fill = $bindable(),
    palette,
    onUseColours,
    oneMotif = false,
  }: {
    fill: ZoneFill;
    /** The zone shows one whole motif per region, so it sets the repeat itself. */
    oneMotif?: boolean;
    palette: string[];
    onUseColours: (colours: string[]) => void;
  } = $props();

  const id = $props.id();
  const generator = $derived(getGenerator(fill.generator));
</script>

<div class="field">
  <label for={id}>Motif</label>
  <select {id} value={fill.generator} onchange={(event) => setZoneGenerator(fill, event.currentTarget.value)}>
    {#each GENERATORS as option (option.id)}
      <option value={option.id}>{option.name}</option>
    {/each}
  </select>
  <p class="help">{generator.about}</p>
</div>

{#each generator.params as def (generator.id + def.key)}
  {#if def.type === 'code'}
    <CodeEditor bind:value={() => String(fill.params[def.key]), (code) => (fill.params[def.key] = code)} />
  {:else if def.type === 'asset'}
    <MotifPicker
      bind:value={() => String(fill.params[def.key]), (motifId) => (fill.params[def.key] = motifId)}
      {palette}
      {onUseColours}
    />
  {:else}
    <ParamControl {def} bind:value={fill.params[def.key]} disabled={oneMotif && ONE_MOTIF_KEYS.includes(def.key)} />
  {/if}
{/each}
{#if oneMotif && generator.params.some((def) => ONE_MOTIF_KEYS.includes(def.key))}
  <p class="help">
    Each square holds one whole motif, so its size follows the square size. Turn off “One motif per square” in the
    layout settings to set it yourself.
  </p>
{/if}
