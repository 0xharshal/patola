<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import FileButton from './FileButton.svelte';
  import MotifCanvas, { type Tool } from './MotifCanvas.svelte';
  import { downloadBlob, safeFilename } from './download';
  import { SLOT_NAMES, slotColour } from '../palettes/presets';
  import { SLOT, ZARI_SLOT } from '../generators/types';
  import { MAX_MOTIF_CELLS, motifFromFile, motifToFile, type MotifGrid } from '../motifs/format';
  import { blankGrid, copyGrid, flipGrid, resizeGrid, type Mirror } from '../motifs/editing';
  import { newUserMotif, saveMotif, type Motif } from '../motifs/library';

  /**
   * Draw a motif cell by cell. Built-in motifs are edited as a copy; the user's
   * own motifs can be saved in place or as a copy.
   */
  let {
    motif,
    palette,
    onSaved,
    onClose,
  }: {
    /** Motif to start from; null starts a blank one. */
    motif: Motif | null;
    palette: string[];
    /** Called after saving; `stored` is false if browser storage was full. */
    onSaved: (motif: Motif, stored: boolean) => void;
    onClose: () => void;
  } = $props();

  const TOOLS: { id: Tool; label: string; help: string }[] = [
    { id: 'paint', label: 'Paint', help: 'Drag to paint cells' },
    { id: 'fill', label: 'Fill', help: 'Fill an area of one colour' },
    { id: 'pick', label: 'Pick', help: 'Pick the colour of a cell' },
  ];
  const SWATCHES = [...SLOT_NAMES.map((name, slot) => ({ slot, name })), { slot: ZARI_SLOT, name: 'Zari' }];
  const UNDO_LIMIT = 50;

  // The editor starts from the motif it was opened with and ignores later changes to the prop.
  const startMotif = untrack(() => motif);
  const canOverwrite = startMotif !== null && !startMotif.builtIn;
  const startGrid = startMotif ? copyGrid(startMotif) : blankGrid(24, 24);
  let grid: MotifGrid = $state(startGrid);
  let name = $state(startMotif ? (startMotif.builtIn ? `${startMotif.name} copy` : startMotif.name) : 'My motif');
  let tool: Tool = $state('paint');
  let currentSlot = $state<number>(SLOT.primary);
  let mirror: Mirror = $state({ leftRight: false, topBottom: false });
  let newWidth = $state(startGrid.width);
  let newHeight = $state(startGrid.height);
  let status = $state('');
  let undoStack: MotifGrid[] = $state([]);

  let modal: ReturnType<typeof Modal>;
  function remember() {
    undoStack = [...undoStack.slice(-(UNDO_LIMIT - 1)), copyGrid(grid)];
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    undoStack = undoStack.slice(0, -1);
    grid = previous;
    [newWidth, newHeight] = [grid.width, grid.height];
  }

  function replaceGrid(next: MotifGrid) {
    remember();
    grid = next;
    [newWidth, newHeight] = [grid.width, grid.height];
  }

  function applySize() {
    const clamp = (value: number) => Math.min(MAX_MOTIF_CELLS, Math.max(4, Math.round(value) || 4));
    const [width, height] = [clamp(newWidth), clamp(newHeight)];
    if (width !== grid.width || height !== grid.height) replaceGrid(resizeGrid(grid, width, height));
    [newWidth, newHeight] = [width, height];
  }

  function save(asCopy: boolean) {
    const trimmedName = name.trim() || 'My motif';
    const saved: Motif =
      canOverwrite && !asCopy
        ? { ...startMotif!, ...copyGrid(grid), name: trimmedName }
        : newUserMotif(trimmedName, copyGrid(grid));
    onSaved(saved, saveMotif(saved));
    modal.close();
  }

  function exportFile() {
    const file = motifToFile(name, grid);
    downloadBlob(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      `${safeFilename(name)}.patola-motif.json`,
    );
  }

  async function importFile(file: File) {
    try {
      const result = motifFromFile(JSON.parse(await file.text()));
      if ('error' in result) {
        status = result.error;
        return;
      }
      replaceGrid(result.motif);
      name = result.name;
      status = `Loaded "${result.name}".`;
    } catch {
      status = 'That file could not be read as JSON.';
    }
  }

  /** Ctrl+Z undoes the last stroke (Modal keeps it from undoing the whole design). */
  function onKeydown(event: KeyboardEvent) {
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
    if (isUndo && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      undo();
    }
  }
</script>

<Modal
  bind:this={modal}
  labelledBy="motif-editor-title"
  width="min(1100px, 96vw)"
  height="min(760px, 92dvh)"
  fullScreenOnPhone
  {onClose}
  {onKeydown}
>
  <div class="layout">
    <header>
      <h2 id="motif-editor-title">Motif editor</h2>
      <input class="name" type="text" bind:value={name} maxlength="40" aria-label="Motif name" />
    </header>

    <MotifCanvas {grid} {palette} {mirror} bind:tool bind:currentSlot onBeforeEdit={remember} />

    <aside class="tools">
      <div class="swatches" role="radiogroup" aria-label="Colour">
        {#each SWATCHES as swatch (swatch.slot)}
          <button
            class="swatch"
            role="radio"
            aria-checked={currentSlot === swatch.slot}
            aria-label={swatch.name}
            title={swatch.name}
            style:background={slotColour(palette, swatch.slot)}
            onclick={() => (currentSlot = swatch.slot)}
          ></button>
        {/each}
      </div>

      <div class="button-row" role="radiogroup" aria-label="Tool">
        {#each TOOLS as option (option.id)}
          <button
            class="button"
            class:primary={tool === option.id}
            role="radio"
            aria-checked={tool === option.id}
            title={option.help}
            onclick={() => (tool = option.id)}
          >
            {option.label}
          </button>
        {/each}
        <button
          class="icon-button"
          disabled={undoStack.length === 0}
          onclick={undo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"><Icon name="undo" /></button
        >
      </div>

      <fieldset>
        <legend>Mirror while drawing</legend>
        <label><input type="checkbox" bind:checked={mirror.leftRight} /> Left ↔ right</label>
        <label><input type="checkbox" bind:checked={mirror.topBottom} /> Top ↔ bottom</label>
      </fieldset>

      <div class="button-row">
        <button class="button" onclick={() => replaceGrid(flipGrid(grid, 'leftRight'))}>Flip ↔</button>
        <button class="button" onclick={() => replaceGrid(flipGrid(grid, 'topBottom'))}>Flip ↕</button>
        <button class="button" onclick={() => replaceGrid(blankGrid(grid.width, grid.height))}>Clear</button>
      </div>

      <div class="button-row size">
        <label>Width <input type="number" min="4" max={MAX_MOTIF_CELLS} bind:value={newWidth} /></label>
        <label>Height <input type="number" min="4" max={MAX_MOTIF_CELLS} bind:value={newHeight} /></label>
        <button class="button" onclick={applySize}>Resize</button>
      </div>

      <div class="button-row">
        <button class="button" onclick={exportFile}>Export file</button>
        <FileButton label="Import file" accept=".json,application/json" onFile={importFile} />
      </div>

      <p class="help" aria-live="polite">
        {status ||
          'Colours follow the current palette. Motifs are kept in this browser; export a file to share or back them up.'}
      </p>

      <div class="button-row actions">
        <button class="button" onclick={() => modal.close()}>Cancel</button>
        {#if canOverwrite}<button class="button" onclick={() => save(true)}>Save as copy</button>{/if}
        <button class="button primary" onclick={() => save(false)}>Save and use</button>
      </div>
    </aside>
  </div>
</Modal>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }
  header {
    grid-column: 1 / -1;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
    white-space: nowrap;
  }
  .name {
    max-width: 320px;
  }
  .tools {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    overflow-y: auto;
    border-left: 1px solid var(--line);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }
  .swatch {
    aspect-ratio: 1;
    border: 2px solid var(--line);
    border-radius: var(--radius);
  }
  .swatch[aria-checked='true'] {
    border-color: var(--text);
    box-shadow: 0 0 0 2px var(--panel) inset;
  }
  fieldset {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: 0.9rem;
  }
  legend {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .size {
    align-items: end;
    flex-wrap: nowrap;
  }
  .size label {
    display: grid;
    gap: 2px;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .size input {
    color: var(--text);
  }
  /* Keep Save / Cancel reachable when the tools scroll (phones). */
  .actions {
    position: sticky;
    bottom: -16px;
    margin-top: auto;
    padding: 8px 0 16px;
    justify-content: flex-end;
    background: var(--panel);
  }

  /* Phones: grid on top, tools below, full screen. */
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr) auto;
    }
    .tools {
      border-left: 0;
      border-top: 1px solid var(--line);
      max-height: 45dvh;
    }
  }
</style>
