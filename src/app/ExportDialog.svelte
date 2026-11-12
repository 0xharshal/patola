<script lang="ts">
  import Modal from './Modal.svelte';
  import { downloadBlob } from './download';
  import { EXPORT_FORMATS, type ExportFormat } from '../core/url';
  import { FORMAT_LABELS, runExport, type ExportSource } from '../export/exporter';
  import {
    formatMegapixels,
    imageSize,
    MAX_EXPORT_SIDE,
    MAX_JPEG_PIXELS,
    presetLongSide,
    scaleForLongSide,
    SIZE_PRESETS,
    type SizePresetId,
  } from '../export/sizes';

  /** Choose format and size, then export with progress and cancel. */
  let { source, onClose }: { source: ExportSource; onClose: () => void } = $props();

  let modal: ReturnType<typeof Modal>;
  let format: ExportFormat = $state('png');
  let presetId: SizePresetId = $state('threads');
  let customLongSide = $state(6000);
  let jpegQuality = $state(0.92);
  let progress: number | null = $state(null);
  let message = $state('');
  let controller: AbortController | null = null;

  const threadPx = $derived(source.frame.render.threadPx);
  const pixelsPerThread = $derived.by(() => {
    if (presetId === 'threads') return threadPx;
    const preset = SIZE_PRESETS.find((candidate) => candidate.id === presetId)!;
    const longSide =
      presetId === 'custom' ? Math.min(MAX_EXPORT_SIDE, Math.max(64, customLongSide || 64)) : presetLongSide(preset)!;
    return scaleForLongSide(source.pieceThreads, longSide);
  });
  const size = $derived(imageSize(source.pieceThreads, pixelsPerThread));
  const isImage = $derived(format === 'png' || format === 'jpg');
  const tooLarge = $derived(Math.max(size.width, size.height) > MAX_EXPORT_SIDE);
  const warnings = $derived.by(() => {
    const list: string[] = [];
    if (format === 'svg')
      list.push(
        'SVG holds the flat design; the woven look and ikat edges are pixel effects and only appear in PNG and JPG.',
      );
    if (format === 'design')
      list.push('Includes your own motifs and code, so it opens the same anywhere (code waits for Run).');
    if (isImage && pixelsPerThread < 1.5)
      list.push(
        'Threads are smaller than about a pixel here, so the weave blends into flat colour. Choose a larger size to see threads.',
      );
    if (format === 'jpg' && size.width * size.height > MAX_JPEG_PIXELS)
      list.push('This may be too large for a JPG in this browser; PNG works at any size.');
    if (tooLarge) list.push(`The long side is limited to ${MAX_EXPORT_SIDE.toLocaleString()} px.`);
    return list;
  });

  async function startExport() {
    controller = new AbortController();
    progress = 0;
    message = '';
    try {
      const result = await runExport({ format, pixelsPerThread, jpegQuality }, source, {
        signal: controller.signal,
        onProgress: (fraction) => (progress = fraction),
      });
      downloadBlob(result.blob, result.filename);
      message = `Saved ${result.filename} (${(result.blob.size / 1e6).toFixed(1)} MB).`;
    } catch (problem) {
      message =
        problem instanceof DOMException && problem.name === 'AbortError'
          ? 'Export cancelled.'
          : problem instanceof Error
            ? problem.message
            : String(problem);
    } finally {
      progress = null;
      controller = null;
    }
  }

  function onCancel(event: Event) {
    // Esc while exporting cancels the export instead of closing the dialog.
    if (controller) {
      event.preventDefault();
      controller.abort();
    }
  }
</script>

<Modal bind:this={modal} labelledBy="export-title" width="min(480px, 94vw)" {onClose} {onCancel}>
  <div class="content">
    <h2 id="export-title">Export</h2>

    <div class="formats" role="radiogroup" aria-label="Format">
      {#each EXPORT_FORMATS as option (option)}
        <button
          class="button"
          class:primary={format === option}
          role="radio"
          aria-checked={format === option}
          onclick={() => (format = option)}
        >
          {FORMAT_LABELS[option]}
        </button>
      {/each}
    </div>

    {#if format !== 'design'}
      <div class="field">
        <label for="export-size">Size</label>
        <select id="export-size" bind:value={presetId}>
          {#each SIZE_PRESETS as preset (preset.id)}
            <option value={preset.id}
              >{preset.id === 'threads' ? `${preset.label} (${threadPx} px per thread)` : preset.label}</option
            >
          {/each}
        </select>
        {#if presetId === 'custom'}
          <label class="inline">
            Long side
            <input type="number" min="64" max={MAX_EXPORT_SIDE} bind:value={customLongSide} />
            px
          </label>
        {/if}
        <p class="help">
          {size.width.toLocaleString()} × {size.height.toLocaleString()} px · {formatMegapixels(size)} · {pixelsPerThread.toFixed(
            2,
          )} px per thread
        </p>
      </div>
    {/if}

    {#if format === 'jpg'}
      <div class="field">
        <label for="jpeg-quality">Quality {Math.round(jpegQuality * 100)} %</label>
        <input id="jpeg-quality" type="range" min="0.5" max="1" step="0.01" bind:value={jpegQuality} />
      </div>
    {/if}

    {#each warnings as warning (warning)}<p class="help">{warning}</p>{/each}

    {#if progress !== null}
      <progress max="1" value={progress} aria-label="Export progress"></progress>
    {/if}
    {#if message}<p class="message" aria-live="polite">{message}</p>{/if}

    <div class="button-row actions">
      {#if progress !== null}
        <button class="button" onclick={() => controller?.abort()}>Cancel export</button>
      {:else}
        <button class="button" onclick={() => modal.close()}>Close</button>
        <button class="button primary" disabled={tooLarge && format !== 'design'} onclick={startExport}
          >Export {FORMAT_LABELS[format]}</button
        >
      {/if}
    </div>
  </div>
</Modal>

<style>
  .content {
    display: grid;
    gap: 14px;
    padding: 18px;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .formats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .inline {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .inline input {
    width: 110px;
    color: var(--text);
  }
  progress {
    width: 100%;
    accent-color: var(--accent);
  }
  .message {
    margin: 0;
    font-size: 0.9rem;
  }
  .actions {
    justify-content: flex-end;
  }
</style>
