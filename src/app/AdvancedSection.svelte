<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import CanvasSize from './CanvasSize.svelte';
  import { DEVICE_SCHEMA, type DeviceSettings } from '../core/deviceSettings';
  import type { Design } from '../core/design';
  import type { Size } from '../layouts/types';

  /** Canvas size (part of the design) and settings for this device only (kept in this browser, not in links). */
  let {
    design = $bindable(),
    device = $bindable(),
    gpuName,
    screenPixels,
    pieceThreads,
  }: { design: Design; device: DeviceSettings; gpuName: string; screenPixels: Size; pieceThreads: Size } = $props();
</script>

<PanelSection title="Advanced" open={false}>
  <CanvasSize bind:design {screenPixels} {pieceThreads} />
  <h3 class="subheading">This device</h3>
  <p class="help">These stay in this browser and are not part of shared links.</p>
  {#each DEVICE_SCHEMA as def (def.key)}
    <ParamControl {def} bind:value={() => device[def.key], (value) => Object.assign(device, { [def.key]: value })} />
  {/each}
  <p class="help">
    Drawing with: {gpuName || 'unknown'}. If the browser keeps using the wrong card, choose it for the browser in your
    system's graphics settings (on Linux, e.g. start the browser with <code>DRI_PRIME=1</code>).
  </p>
</PanelSection>
