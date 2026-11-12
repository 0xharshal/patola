<script lang="ts">
  import Icon from './Icon.svelte';
  import ParamControl from './ParamControl.svelte';
  import PanelSection from './PanelSection.svelte';
  import { LAYOUTS, getLayout } from '../layouts/registry';
  import { BODY_ZONE } from '../layouts/types';
  import { applyLayout, type Design } from '../core/design';

  /** Choose the piece, pick the part (zone) to edit, and set the piece's proportions. */
  let {
    design = $bindable(),
    selectedZone = $bindable(),
    onFocusZone,
    onShowAll,
  }: {
    design: Design;
    /** Id of the zone whose pattern the Pattern section edits. */
    selectedZone: string;
    onFocusZone: (zoneId: string) => void;
    onShowAll: () => void;
  } = $props();

  const layout = $derived(getLayout(design.layout));
  const zoneChoices = $derived([{ id: BODY_ZONE, ...layout.body }, ...layout.zones]);

  function chooseLayout(layoutId: string) {
    applyLayout(design, layoutId);
    selectedZone = BODY_ZONE;
  }
</script>

<PanelSection title="Layout">
  <div class="field">
    <label for="layout">Piece</label>
    <select id="layout" value={design.layout} onchange={(event) => chooseLayout(event.currentTarget.value)}>
      {#each LAYOUTS as option (option.id)}
        <option value={option.id}>{option.name}</option>
      {/each}
    </select>
    <p class="help">{layout.about}</p>
  </div>
  {#if layout.zones.length > 0}
    <div class="field">
      <span class="field-label">Parts: choose one to edit its pattern</span>
      <ul class="zones">
        {#each zoneChoices as zone (zone.id)}
          <li>
            <button
              class="button zone"
              class:selected={zone.id === selectedZone}
              aria-pressed={zone.id === selectedZone}
              onclick={() => (selectedZone = zone.id)}
            >
              {zone.name}
            </button>
            <button
              class="icon-button"
              title="Zoom to {zone.name}"
              aria-label="Zoom to {zone.name}"
              onclick={() => onFocusZone(zone.id)}
            >
              <Icon name="focus" />
            </button>
          </li>
        {/each}
      </ul>
      <button class="button" onclick={onShowAll}>Show the whole piece</button>
    </div>
  {/if}
  {#each layout.settings as def (layout.id + def.key)}
    <ParamControl {def} bind:value={design.layoutSettings[def.key]} />
  {/each}
</PanelSection>

<style>
  .zones {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .zones li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
  }
  .zone {
    justify-content: flex-start;
  }
  .zone.selected {
    border-color: var(--accent);
    box-shadow: inset 3px 0 0 var(--accent);
    font-weight: 600;
  }
</style>
