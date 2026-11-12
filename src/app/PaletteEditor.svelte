<script lang="ts">
  import Icon from './Icon.svelte';
  import FileButton from './FileButton.svelte';
  import { readImagePixels } from '../core/imageFile';
  import type { Design } from '../core/design';
  import { mulberry32, randomSeed } from '../core/rng';
  import { randomizeColours } from '../core/randomize';
  import { PALETTES, SLOT_NAMES, getPalette, normalizeHex } from '../palettes/presets';
  import { shufflePalette } from '../palettes/random';
  import { extractPalette } from '../palettes/extract';
  import { loadSavedPalettes, newPaletteId, storeSavedPalettes, type SavedPalette } from '../palettes/storage';

  let { design = $bindable(), locked = $bindable() }: { design: Design; locked: boolean[] } = $props();

  const id = $props.id();
  let saved: SavedPalette[] = $state(loadSavedPalettes());
  let status = $state('');
  const isSaved = $derived(saved.some((palette) => palette.id === design.paletteId));

  function showStatus(message: string) {
    status = message;
    setTimeout(() => (status = ''), 2500);
  }

  function setColours(colours: string[]) {
    design.palette = colours;
    design.paletteId = null;
  }

  function choose(paletteId: string) {
    const palette = getPalette(paletteId) ?? saved.find((candidate) => candidate.id === paletteId);
    if (!palette) return;
    design.paletteId = palette.id;
    design.palette = [...palette.colors];
  }

  function setColour(slot: number, value: string) {
    const hex = normalizeHex(value);
    if (hex) setColours(design.palette.map((colour, index) => (index === slot ? hex : colour)));
  }

  function move(slot: number, direction: -1 | 1) {
    const other = slot + direction;
    const colours = [...design.palette];
    [colours[slot], colours[other]] = [colours[other], colours[slot]];
    [locked[slot], locked[other]] = [locked[other], locked[slot]];
    setColours(colours);
  }

  function save() {
    const name = window.prompt('Name for this palette', `My palette ${saved.length + 1}`)?.trim();
    if (!name) return;
    const entry: SavedPalette = { id: newPaletteId(), name, colors: [...design.palette] };
    saved = [...saved, entry];
    showStatus(
      storeSavedPalettes(saved) ? `Saved "${name}" in this browser` : 'Could not save: browser storage is unavailable',
    );
    design.paletteId = entry.id;
  }

  function remove() {
    const entry = saved.find((palette) => palette.id === design.paletteId);
    if (!entry || !window.confirm(`Delete the palette "${entry.name}"?`)) return;
    saved = saved.filter((palette) => palette.id !== entry.id);
    storeSavedPalettes(saved);
    design.paletteId = null;
  }

  /** Colours are found on a small copy of the photo: plenty for k-means, and fast. */
  const PHOTO_SAMPLE_SIDE = 96;

  async function fromPhoto(file: File) {
    try {
      const colours = extractPalette((await readImagePixels(file, PHOTO_SAMPLE_SIDE)).rgba);
      if (!colours) return showStatus('Could not find enough colours in that image');
      setColours(colours.map((colour, slot) => (locked[slot] || !colour ? design.palette[slot] : colour)));
      showStatus('Colours taken from your photo');
    } catch {
      showStatus('Could not read that image');
    }
  }
</script>

<div class="editor">
  <div class="field">
    <label for={id}>Palette</label>
    <select {id} value={design.paletteId ?? 'custom'} onchange={(event) => choose(event.currentTarget.value)}>
      <optgroup label="Presets">
        {#each PALETTES as palette (palette.id)}
          <option value={palette.id}>{palette.name}</option>
        {/each}
      </optgroup>
      {#if saved.length}
        <optgroup label="Saved in this browser">
          {#each saved as palette (palette.id)}
            <option value={palette.id}>{palette.name}</option>
          {/each}
        </optgroup>
      {/if}
      {#if design.paletteId === null}<option value="custom">Custom (unsaved)</option>{/if}
    </select>
  </div>

  <ul class="slots">
    {#each design.palette as colour, slot (slot)}
      <li>
        <input
          class="swatch"
          type="color"
          value={colour}
          aria-label="{SLOT_NAMES[slot]} colour"
          oninput={(event) => setColour(slot, event.currentTarget.value)}
        />
        <div class="name">
          <span>{SLOT_NAMES[slot]}</span>
          <input
            class="hex"
            type="text"
            value={colour}
            maxlength="7"
            spellcheck="false"
            aria-label="{SLOT_NAMES[slot]} hex value"
            onchange={(event) => setColour(slot, event.currentTarget.value)}
          />
        </div>
        <button
          class="icon-button"
          class:on={locked[slot]}
          aria-pressed={locked[slot]}
          aria-label="{locked[slot] ? 'Unlock' : 'Lock'} {SLOT_NAMES[slot]}"
          title={locked[slot] ? 'Unlock: shuffle and random may change it' : 'Lock: keep this colour when shuffling'}
          onclick={() => (locked[slot] = !locked[slot])}
        >
          <Icon name={locked[slot] ? 'locked' : 'unlocked'} />
        </button>
        <button
          class="icon-button"
          disabled={slot === 0}
          aria-label="Move {SLOT_NAMES[slot]} up"
          onclick={() => move(slot, -1)}
        >
          <Icon name="up" />
        </button>
        <button
          class="icon-button"
          disabled={slot === design.palette.length - 1}
          aria-label="Move {SLOT_NAMES[slot]} down"
          onclick={() => move(slot, 1)}
        >
          <Icon name="down" />
        </button>
      </li>
    {/each}
  </ul>

  <div class="button-row">
    <button class="button" onclick={() => setColours(shufflePalette(design.palette, locked, mulberry32(randomSeed())))}
      >Shuffle</button
    >
    <button class="button" onclick={() => randomizeColours(design, locked)}>Random</button>
    <FileButton label="From photo" accept="image/*" onFile={fromPhoto} />
    <button class="button" onclick={save}>Save</button>
    {#if isSaved}<button class="button" onclick={remove}>Delete</button>{/if}
  </div>
  <p class="help" aria-live="polite">
    {status || 'Locked colours stay put. Photos are read on this device and never uploaded.'}
  </p>
</div>

<style>
  .editor {
    display: grid;
    gap: 12px;
  }
  .slots {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  li {
    display: grid;
    grid-template-columns: 44px 1fr repeat(3, 36px);
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 44px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: none;
    cursor: pointer;
  }
  .name {
    display: grid;
    min-width: 0;
  }
  .name span {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .hex {
    min-height: 0;
    border: 0;
    border-bottom: 1px dashed var(--line);
    border-radius: 0;
    background: transparent;
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
    padding: 1px 0;
  }
</style>
