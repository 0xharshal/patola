<script lang="ts">
  import Icon from './Icon.svelte';
  import FileButton from './FileButton.svelte';
  import PaletteEditor from './PaletteEditor.svelte';
  import PanelSection from './PanelSection.svelte';
  import LayoutSection from './LayoutSection.svelte';
  import WeaveSection from './WeaveSection.svelte';
  import ExhibitionSection from './ExhibitionSection.svelte';
  import AdvancedSection from './AdvancedSection.svelte';
  import type { DeviceSettings } from '../core/deviceSettings';
  import ZonePattern from './ZonePattern.svelte';
  import VersionPicker from './VersionPicker.svelte';
  import { getLayout, patternOnly } from '../layouts/registry';
  import { BODY_ZONE, holdsOneMotif, type Size } from '../layouts/types';
  import { SLOT_COUNT } from '../palettes/presets';
  import { zoneFill, type Design } from '../core/design';
  import type { Params } from '../core/params';
  import { randomizeColours, randomizePattern, surprise } from '../core/randomize';

  /** The control panel: a side panel on desktop, a bottom sheet on phones. */
  let {
    design = $bindable(),
    exhibition = $bindable(),
    device = $bindable(),
    gpuName,
    screenPixels,
    pieceThreads,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onFocusZone,
    onShowAll,
    onCopyLink,
    onStartExhibition,
    onCopyExhibitionLink,
    onExport,
    onInstall,
    onLearn,
    onOpenDesignFile,
  }: {
    design: Design;
    exhibition: Params;
    device: DeviceSettings;
    /** Graphics card drawing, as the browser names it. */
    gpuName: string;
    screenPixels: Size;
    pieceThreads: Size;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onFocusZone: (zoneId: string) => void;
    onShowAll: () => void;
    onCopyLink: () => Promise<boolean>;
    onStartExhibition: () => void;
    onCopyExhibitionLink: () => Promise<boolean>;
    onExport: () => void;
    /** Install as an app; null when the browser doesn't offer it (or it is installed). */
    onInstall: (() => Promise<void>) | null;
    onLearn: () => void;
    onOpenDesignFile: (file: File) => void;
  } = $props();

  /** Phones only: how much of the screen the bottom sheet takes. */
  let sheet: 'half' | 'full' | 'hidden' = $state('half');
  /** Which link was just copied, for a moment's feedback on its button. */
  let copied: 'design' | 'exhibition' | null = $state(null);
  /** Palette slots kept when shuffling or randomising colours. */
  let locked: boolean[] = $state(Array(SLOT_COUNT).fill(false));
  let selectedZone = $state(BODY_ZONE);

  const layout = $derived(getLayout(design.layout));
  const zoneChoices = $derived([{ id: BODY_ZONE, ...layout.body }, ...layout.zones]);
  const activeZone = $derived(zoneChoices.find((zone) => zone.id === selectedZone) ?? zoneChoices[0]);
  const activeFill = $derived(zoneFill(design, activeZone.id));
  const isPatternOnly = $derived(layout.id === patternOnly.id);

  /** Use an image's colours; an empty entry (a cut-out's background) keeps the current colour. */
  function useColours(colours: string[]) {
    design.palette = design.palette.map((current, slot) => colours[slot] || current);
    design.paletteId = null;
  }

  async function copyLink(which: 'design' | 'exhibition') {
    const done = await (which === 'design' ? onCopyLink() : onCopyExhibitionLink());
    if (!done) return;
    copied = which;
    setTimeout(() => (copied = null), 1600);
  }
</script>

<aside class="panel sheet-{sheet}" aria-label="Design controls">
  <button
    class="sheet-handle"
    aria-label={sheet === 'full' ? 'Make the controls smaller' : 'Make the controls larger'}
    onclick={() => (sheet = sheet === 'full' ? 'half' : 'full')}
  ></button>
  <header>
    <h1>Patola Playground</h1>
    <div class="button-row">
      <button class="button" onclick={onLearn} title="How patola is made, and the patterns in this playground">
        Learn
      </button>
      <button class="icon-button" disabled={!canUndo} onclick={onUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        <Icon name="undo" />
      </button>
      <button class="icon-button" disabled={!canRedo} onclick={onRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        <Icon name="redo" />
      </button>
      <button
        class="button sheet-toggle"
        aria-expanded={sheet !== 'hidden'}
        onclick={() => (sheet = sheet === 'hidden' ? 'half' : 'hidden')}
      >
        {sheet === 'hidden' ? 'Show' : 'Hide'}
      </button>
    </div>
  </header>

  <div class="body">
    <div class="randomise" role="group" aria-label="Randomise">
      <button class="button primary wide" onclick={() => surprise(design, locked)}>Surprise me</button>
      <button class="button" onclick={() => randomizePattern(activeFill)} title="New settings for the selected pattern">
        Shuffle pattern
      </button>
      <button class="button" onclick={() => randomizeColours(design, locked)} title="New colours (locked colours stay)">
        Shuffle colours
      </button>
    </div>

    <LayoutSection bind:design bind:selectedZone {onFocusZone} {onShowAll} />

    <PanelSection title={isPatternOnly ? 'Pattern' : `Pattern: ${activeZone.name}`}>
      {#if activeZone.about}<p class="help">{activeZone.about}</p>{/if}
      {#key activeZone.id + design.layout}
        <ZonePattern
          fill={activeFill}
          palette={design.palette}
          onUseColours={useColours}
          oneMotif={holdsOneMotif(activeZone, design.layoutSettings)}
        />
      {/key}
    </PanelSection>

    <PanelSection title="Colours">
      <PaletteEditor bind:design bind:locked />
    </PanelSection>

    <WeaveSection bind:design />

    <ExhibitionSection bind:exhibition />

    <AdvancedSection bind:design bind:device {gpuName} {screenPixels} {pieceThreads} />

    <div class="actions">
      <button class="button primary" onclick={onExport}>Export…</button>
      <button class="button primary" onclick={onStartExhibition}>Start exhibition</button>
      <FileButton label="Open design file…" accept=".json,application/json" onFile={onOpenDesignFile} />
      <button class="button" onclick={() => copyLink('design')}
        >{copied === 'design' ? 'Link copied' : 'Copy link'}</button
      >
      <button
        class="button"
        onclick={() => copyLink('exhibition')}
        title="A link that opens straight into this exhibition, e.g. for a kiosk"
      >
        {copied === 'exhibition' ? 'Link copied' : 'Copy exhibition link'}
      </button>
      {#if onInstall}
        <button class="button" onclick={onInstall} title="Use it like an app, also offline">Install app</button>
      {/if}
    </div>
    <VersionPicker />
  </div>
</aside>

<style>
  .panel {
    background: var(--panel);
    border-left: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }
  h1 {
    font-size: 1.05rem;
    margin: 0;
  }
  .sheet-toggle,
  .sheet-handle {
    display: none;
  }
  .body {
    overflow-y: auto;
    padding: 4px 16px 16px;
    overscroll-behavior: contain;
  }
  .randomise {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .wide {
    grid-column: 1 / -1;
  }
  .actions {
    display: grid;
    gap: 8px;
    padding-top: 16px;
  }

  /* Phones: the panel becomes a bottom sheet. */
  @media (max-width: 760px) {
    .panel {
      position: relative;
      border-left: 0;
      border-top: 1px solid var(--line);
      max-height: 50dvh;
      transition: max-height 0.2s ease;
      border-radius: 14px 14px 0 0;
      box-shadow: 0 -4px 16px rgb(0 0 0 / 0.12);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .panel.sheet-full {
      max-height: 88dvh;
    }
    header {
      padding: 14px 12px 8px 16px;
    }
    h1 {
      font-size: 0.95rem;
    }
    .sheet-toggle {
      display: inline-flex;
      border-radius: 999px;
    }
    /* Grab handle: tap to switch between half and full height. */
    .sheet-handle {
      display: block;
      position: absolute;
      top: 0;
      left: 50%;
      translate: -50% 0;
      width: 72px;
      height: 18px;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .sheet-handle::after {
      content: '';
      display: block;
      width: 40px;
      height: 4px;
      margin: 7px auto 0;
      border-radius: 2px;
      background: var(--line);
    }
    .sheet-hidden .body,
    .sheet-hidden .sheet-handle {
      display: none;
    }
  }
</style>
