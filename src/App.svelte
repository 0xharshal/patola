<script lang="ts">
  import { onMount } from 'svelte';
  import Panel from './app/Panel.svelte';
  import Viewport from './app/Viewport.svelte';
  import { clampSize, renderSettings, type Design } from './core/design';
  import { compose } from './core/compose';
  import { designToQuery, type UrlState } from './core/url';
  import { compactQuery } from './core/compactLink';
  import { designFromFile } from './core/designFile';
  import { applyGuideAction } from './education/guide';
  import { History } from './core/history';
  import { onCodeResult } from './custom/codeRunner';
  import { onMotifsChanged } from './motifs/library';
  import { downloadBlob } from './app/download';
  import type { ExportSource } from './export/exporter';
  import { scaleForLongSide } from './export/sizes';
  import type { Size } from './layouts/types';

  let { initial }: { initial: UrlState } = $props();
  // The URL is read once at start-up; later changes come from the editor.
  // svelte-ignore state_referenced_locally
  const view = initial.view;
  // svelte-ignore state_referenced_locally
  let design: Design = $state(initial.design);
  let viewportComponent: ReturnType<typeof Viewport> | undefined = $state();

  let innerWidth = $state(window.innerWidth);
  let innerHeight = $state(window.innerHeight);
  let dpr = $state(window.devicePixelRatio || 1);

  /** Pixel size for the "pattern only" layout: custom, or this screen. */
  const screenPixels: Size = $derived(
    design.size ?? { width: clampSize(innerWidth * dpr), height: clampSize(innerHeight * dpr) },
  );

  // Custom code finishes running and images get uploaded asynchronously: recompose then.
  let customContentVersion = $state(0);
  onMount(() => {
    const stopCode = onCodeResult(() => customContentVersion++);
    const stopMotifs = onMotifsChanged(() => customContentVersion++);
    return () => {
      stopCode();
      stopMotifs();
    };
  });

  const composition = $derived.by(() => {
    void customContentVersion;
    return compose(design, screenPixels);
  });
  const render = $derived(renderSettings(design.render));
  const threadsPerCell = $derived(render.step);
  const pieceThreads: Size = $derived({
    width: composition.grid.width * threadsPerCell,
    height: composition.grid.height * threadsPerCell,
  });
  const frame = $derived({
    grid: composition.grid,
    warpHorizontal: composition.layout.warpHorizontal,
    palette: design.palette,
    mode: design.mode,
    render,
    seed: design.seed,
  });

  /** Show one zone (its first region) in the viewport. */
  function focusZone(zoneId: string) {
    const region = composition.regions.find((candidate) => candidate.zone === zoneId);
    if (!region || !viewportComponent) return;
    viewportComponent.fit({
      x: region.x * threadsPerCell,
      y: region.y * threadsPerCell,
      width: region.width * threadsPerCell,
      height: region.height * threadsPerCell,
    });
  }

  // Keep the address bar a valid share link (not in wallpaper view, so seed=random keeps rotating).
  $effect(() => {
    if (view !== 'editor') return;
    const query = designToQuery(design);
    const timer = setTimeout(() => history.replaceState(null, '', `?${query}`), 250);
    return () => clearTimeout(timer);
  });

  // Undo/redo: snapshot the design after edits settle, so a slider drag is one step.
  // svelte-ignore state_referenced_locally
  const undoStack = new History(JSON.stringify(initial.design));
  let historyVersion = $state(0);
  let pendingSnapshot: ReturnType<typeof setTimeout> | undefined;
  const canUndo = $derived(historyVersion >= 0 && undoStack.canUndo);
  const canRedo = $derived(historyVersion >= 0 && undoStack.canRedo);

  function commitSnapshot(snapshot: string) {
    clearTimeout(pendingSnapshot);
    if (undoStack.record(snapshot)) historyVersion++;
  }

  $effect(() => {
    if (view !== 'editor') return;
    const snapshot = JSON.stringify(design);
    clearTimeout(pendingSnapshot);
    pendingSnapshot = setTimeout(() => commitSnapshot(snapshot), 400);
  });

  function travel(direction: 'undo' | 'redo') {
    commitSnapshot(JSON.stringify(design)); // keep any edit that hasn't been recorded yet
    const snapshot = direction === 'undo' ? undoStack.undo() : undoStack.redo();
    if (snapshot === null) return;
    design = JSON.parse(snapshot);
    historyVersion++;
  }

  function onKeydown(event: KeyboardEvent) {
    if (view !== 'editor' || !(event.ctrlKey || event.metaKey)) return;
    // Text fields keep their own undo.
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && ['text', 'number'].includes(target.type))
    )
      return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) travel('undo');
    else if ((key === 'z' && event.shiftKey) || key === 'y') travel('redo');
    else return;
    event.preventDefault();
  }

  function linkFor(targetView: 'editor' | 'wallpaper'): string {
    return `${location.origin}${location.pathname}?${designToQuery(design, targetView)}`;
  }

  /** Links longer than this are shared in compact form (d=…), e.g. when they carry code. */
  const LONG_LINK = 1800;

  async function copyLink(): Promise<boolean> {
    const readable = linkFor('editor');
    const url =
      readable.length > LONG_LINK
        ? `${location.origin}${location.pathname}?${await compactQuery(designToQuery(design))}`
        : readable;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      window.prompt('Copy this link', url);
      return false;
    }
  }

  // Short messages over the picture (export progress, opened files, errors).
  let notice = $state('');
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  function showNotice(message: string, keep = false) {
    notice = message;
    clearTimeout(noticeTimer);
    if (!keep) noticeTimer = setTimeout(() => (notice = ''), 5000);
  }

  /** Which dialog is open. Dialogs are loaded on first use to keep the first page load small. */
  let openDialog: 'export' | 'learn' | null = $state(null);
  const exportSource: ExportSource = $derived({ design, composition, frame, pieceThreads });

  async function openDesignFile(file: File) {
    try {
      const result = designFromFile(JSON.parse(await file.text()));
      if ('error' in result) return showNotice(result.error);
      design = result.design;
      showNotice(`Opened ${file.name}${result.addedMotifs ? `, added ${result.addedMotifs} motif(s)` : ''}.`);
    } catch {
      showNotice('That file could not be read as a design.');
    }
  }

  // `download=` links: export once, as soon as the page is ready.
  onMount(() => {
    const request = initial.download;
    if (!request) return;
    const pixelsPerThread = request.longSide ? scaleForLongSide(pieceThreads, request.longSide) : render.threadPx;
    showNotice('Preparing download…', true);
    import('./export/exporter')
      .then(({ runExport }) =>
        runExport({ format: request.format, pixelsPerThread }, exportSource, {
          onProgress: (fraction) => showNotice(`Preparing download… ${Math.round(fraction * 100)} %`, true),
        }),
      )
      .then((result) => {
        downloadBlob(result.blob, result.filename);
        showNotice(`Downloaded ${result.filename}`);
      })
      .catch((problem) => showNotice(problem instanceof Error ? problem.message : String(problem)));
  });
</script>

<svelte:window
  bind:innerWidth
  bind:innerHeight
  onresize={() => (dpr = window.devicePixelRatio || 1)}
  onkeydown={onKeydown}
/>

<div class="app" class:wallpaper={view === 'wallpaper'}>
  <main class="main">
    <Viewport
      bind:this={viewportComponent}
      {frame}
      {pieceThreads}
      threadPx={render.threadPx}
      interactive={view === 'editor'}
      fitMode={view === 'wallpaper' ? 'cover' : 'contain'}
    />
  </main>
  {#if view === 'editor'}
    <Panel
      bind:design
      {screenPixels}
      {pieceThreads}
      {canUndo}
      {canRedo}
      onUndo={() => travel('undo')}
      onRedo={() => travel('redo')}
      onFocusZone={focusZone}
      onShowAll={() => viewportComponent?.fit()}
      onCopyLink={copyLink}
      onOpenWallpaper={() => window.open(linkFor('wallpaper'), '_blank', 'noopener')}
      onExport={() => (openDialog = 'export')}
      onLearn={() => (openDialog = 'learn')}
      onOpenDesignFile={openDesignFile}
    />
  {/if}
  {#if openDialog === 'export'}
    {#await import('./app/ExportDialog.svelte') then { default: ExportDialog }}
      <ExportDialog source={exportSource} onClose={() => (openDialog = null)} />
    {/await}
  {:else if openDialog === 'learn'}
    {#await import('./app/LearnDialog.svelte') then { default: LearnDialog }}
      <LearnDialog onAction={(action) => applyGuideAction(design, action)} onClose={() => (openDialog = null)} />
    {/await}
  {/if}
  {#if notice}
    <p class="notice" role="status">{notice}</p>
  {/if}
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    height: 100dvh;
  }
  .main {
    min-width: 0;
    min-height: 0;
  }
  .wallpaper {
    display: block;
  }
  .notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    max-width: min(420px, calc(100vw - 32px));
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: var(--text);
    color: var(--bg);
    font-size: 0.9rem;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.25);
    z-index: 10;
  }
  .wallpaper .main {
    position: fixed;
    inset: 0;
  }

  @media (max-width: 760px) {
    .app:not(.wallpaper) {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) auto;
    }
  }
</style>
