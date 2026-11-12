<script lang="ts">
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import { DEVICE_SCHEMA, type DeviceSettings } from '../core/deviceSettings';

  /** Settings for this device only (kept in this browser, not in links). */
  let { device = $bindable(), gpuName }: { device: DeviceSettings; gpuName: string } = $props();
</script>

<PanelSection title="Advanced" open={false}>
  <p class="help">Settings for this device. They stay in this browser and are not part of shared links.</p>
  {#each DEVICE_SCHEMA as def (def.key)}
    <ParamControl {def} bind:value={() => device[def.key], (value) => Object.assign(device, { [def.key]: value })} />
  {/each}
  <p class="help">
    Drawing with: {gpuName || 'unknown'}. If the browser keeps using the wrong card, choose it for the browser in your
    system's graphics settings (on Linux, e.g. start the browser with <code>DRI_PRIME=1</code>).
  </p>
</PanelSection>
