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
  /** Settings only the one-design-at-a-time style uses. */
  const GALLERY_ONLY = new Set(['seconds', 'closeups', 'captions']);

  async function copyLink() {
    copied = await onCopyLink();
    setTimeout(() => (copied = false), 1600);
  }
</script>

<PanelSection title="Exhibition" open={false}>
  <p class="help">
    A full-screen slideshow for a large screen: one design at a time, toured from the whole piece down to single
    threads, or an endless fabric of many designs gliding past. Space pauses, Esc ends it; with one design at a time,
    arrow keys skip.
  </p>
  {#each EXHIBITION_SCHEMA as def (def.key)}
    <ParamControl
      {def}
      bind:value={exhibition[def.key]}
      disabled={exhibition.style === 'fabric' && GALLERY_ONLY.has(def.key)}
    />
  {/each}
  <div class="button-row">
    <button class="button primary" onclick={onStart}>Start exhibition</button>
    <button class="button" onclick={copyLink} title="A link that opens straight into this exhibition, e.g. for a kiosk">
      {copied ? 'Link copied' : 'Copy exhibition link'}
    </button>
  </div>
</PanelSection>
