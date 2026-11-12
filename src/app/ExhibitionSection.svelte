<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import type { Params } from '../core/params';
  import { EXHIBITION_SCHEMA } from '../exhibition/settings';

  /** Settings and start button of the full-screen exhibition (slideshow). */
  let {
    exhibition = $bindable(),
    onStart,
    onCopyLink,
  }: { exhibition: Params; onStart: () => void; onCopyLink: () => Promise<boolean> } = $props();

  let copied = $state(false);

  async function copyLink() {
    copied = await onCopyLink();
    setTimeout(() => (copied = false), 1600);
  }
</script>

<PanelSection title="Exhibition" open={false}>
  <p class="help">
    A full-screen slideshow: the camera glides over each design, from the whole piece down to single threads, then the
    next design fades in. Space pauses, arrow keys skip, Esc ends it.
  </p>
  {#each EXHIBITION_SCHEMA as def (def.key)}
    <ParamControl {def} bind:value={exhibition[def.key]} />
  {/each}
  <div class="button-row">
    <button class="button primary" onclick={onStart}>Start exhibition</button>
    <button class="button" onclick={copyLink} title="A link that opens straight into this exhibition, e.g. for a kiosk">
      {copied ? 'Link copied' : 'Copy exhibition link'}
    </button>
  </div>
</PanelSection>
