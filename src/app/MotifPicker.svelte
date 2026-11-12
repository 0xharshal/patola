<script lang="ts">
  import { onMount } from 'svelte';
  import FileButton from './FileButton.svelte';
  import { MAX_MOTIF_CELLS } from '../motifs/format';
  import { deleteMotif, listMotifs, motifFromImage, onMotifsChanged, saveMotif, type Motif } from '../motifs/library';

  /** Choose, draw, upload or edit a picture motif. */
  let {
    value = $bindable(),
    palette,
    onUseColours,
  }: {
    value: string;
    palette: string[];
    /** Called with an uploaded image's own colours, to use them as the palette. */
    onUseColours: (colours: string[]) => void;
  } = $props();

  const id = $props.id();
  let motifs = $state(listMotifs());
  let uploadSize = $state(40);
  let status = $state('');
  /** undefined: editor closed; null: drawing a new motif; a motif: editing it. */
  let editing: Motif | null | undefined = $state(undefined);

  const selected = $derived(motifs.find((motif) => motif.id === value));
  const missing = $derived(value !== '' && !selected);
  const builtIns = $derived(motifs.filter((motif) => motif.builtIn));
  const own = $derived(motifs.filter((motif) => !motif.builtIn));
  const hasColours = $derived(selected?.colours.some(Boolean) ?? false);

  onMount(() => onMotifsChanged(() => (motifs = listMotifs())));

  const storageWarning = 'browser storage is full, so it will be gone after reloading';

  async function upload(file: File) {
    try {
      const motif = await motifFromImage(file, uploadSize);
      const stored = saveMotif(motif);
      value = motif.id;
      status = `Added "${motif.name}" (${motif.width} × ${motif.height} cells)${stored ? '.' : `, but ${storageWarning}.`}`;
    } catch (problem) {
      status = problem instanceof Error ? problem.message : 'Could not read that image.';
    }
  }

  function onSaved(motif: Motif, stored: boolean) {
    value = motif.id;
    status = stored ? `Saved "${motif.name}".` : `Saved "${motif.name}", but ${storageWarning}.`;
  }

  function remove() {
    if (
      !selected ||
      selected.builtIn ||
      !window.confirm(`Delete "${selected.name}" from this browser? This can't be undone.`)
    )
      return;
    deleteMotif(selected.id);
    value = builtIns[0]?.id ?? '';
  }
</script>

<div class="field">
  <label for={id}>Motif</label>
  <select {id} {value} onchange={(event) => (value = event.currentTarget.value)}>
    <optgroup label="Built-in">
      {#each builtIns as motif (motif.id)}
        <option value={motif.id}>{motif.name}</option>
      {/each}
    </optgroup>
    {#if own.length}
      <optgroup label="Yours (this browser)">
        {#each own as motif (motif.id)}
          <option value={motif.id}>{motif.name} ({motif.width} × {motif.height})</option>
        {/each}
      </optgroup>
    {/if}
    {#if missing}<option {value}>Missing motif</option>{/if}
  </select>
  {#if missing}
    <p class="help">This design uses a motif that is only in its creator's browser.</p>
  {:else if selected?.about}
    <p class="help">{selected.about}</p>
  {/if}

  <div class="button-row">
    <button class="button" onclick={() => (editing = null)}>Draw new</button>
    {#if selected}
      <button class="button" onclick={() => (editing = selected)}>{selected.builtIn ? 'Edit a copy' : 'Edit'}</button>
    {/if}
    <FileButton label="Upload image…" accept="image/*" onFile={upload} />
    {#if hasColours}
      <button class="button" onclick={() => onUseColours(selected!.colours)}>Use its colours</button>
    {/if}
    {#if selected && !selected.builtIn}
      <button class="button" onclick={remove}>Delete</button>
    {/if}
  </div>
  <label class="upload-size">
    Uploads at most
    <input type="number" min="8" max={MAX_MOTIF_CELLS} bind:value={uploadSize} />
    cells
  </label>
  <p class="help" aria-live="polite">
    {status || 'Your motifs are kept in this browser only. Simple pictures with flat colours work best.'}
  </p>
</div>

{#if editing !== undefined}
  {#await import('./MotifEditor.svelte') then { default: MotifEditor }}
    <MotifEditor motif={editing} {palette} {onSaved} onClose={() => (editing = undefined)} />
  {/await}
{/if}

<style>
  .upload-size {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .upload-size input {
    width: 80px;
  }
</style>
