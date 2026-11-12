<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import type { Params } from '../core/params';
  import { EXHIBITION_SCHEMA } from '../exhibition/settings';

  /** Settings of the full-screen exhibition (slideshow); it is started from the panel's actions. */
  let { exhibition = $bindable() }: { exhibition: Params } = $props();

  /** Settings only one of the styles uses. */
  const STYLE_OF_SETTING: Record<string, string> = {
    speed: 'fabric',
    seconds: 'gallery',
    closeups: 'gallery',
    captions: 'gallery',
  };
</script>

<PanelSection title="Exhibition" open={false}>
  <p class="help">
    A full-screen slideshow for a large screen: an endless fabric of many designs gliding past, or one design at a time,
    toured from the whole piece down to single threads. Start it with <em>Start exhibition</em> below. Space pauses, Esc ends
    it; with one design at a time, arrow keys skip.
  </p>
  {#each EXHIBITION_SCHEMA as def (def.key)}
    <ParamControl
      {def}
      bind:value={exhibition[def.key]}
      disabled={def.key in STYLE_OF_SETTING && STYLE_OF_SETTING[def.key] !== exhibition.style}
    />
  {/each}
</PanelSection>
