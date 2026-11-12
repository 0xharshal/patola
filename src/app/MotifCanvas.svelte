<script lang="ts" module>
  export type Tool = 'paint' | 'fill' | 'pick';
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { slotColour } from '../palettes/presets';
  import type { MotifGrid } from '../motifs/format';
  import { cellsOnLine, floodFill, paintCell, type Mirror } from '../motifs/editing';

  /**
   * The motif grid, drawn to fit its box, with pointer painting. Edits change
   * `grid` in place; `onBeforeEdit` runs first so the editor can save an undo step.
   */
  let {
    grid,
    palette,
    mirror,
    tool = $bindable(),
    currentSlot = $bindable(),
    onBeforeEdit,
  }: {
    grid: MotifGrid;
    palette: string[];
    mirror: Mirror;
    tool: Tool;
    currentSlot: number;
    onBeforeEdit: () => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let board: HTMLDivElement;
  let boardSize = $state({ width: 300, height: 300 });
  /** Bumped on in-place edits, so the canvas redraws. */
  let version = $state(0);

  const cellPixels = $derived(
    Math.max(4, Math.floor(Math.min(boardSize.width / grid.width, boardSize.height / grid.height))),
  );

  onMount(() => {
    const observer = new ResizeObserver(
      ([entry]) => (boardSize = { width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(board);
    return () => observer.disconnect();
  });

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const size = cellPixels;
    const fullWidth = grid.width * size;
    const fullHeight = grid.height * size;
    canvas.width = fullWidth * dpr;
    canvas.height = fullHeight * dpr;
    canvas.style.width = `${fullWidth}px`;
    canvas.style.height = `${fullHeight}px`;
    const context = canvas.getContext('2d')!;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        context.fillStyle = slotColour(palette, grid.slots[y * grid.width + x]);
        context.fillRect(x * size, y * size, size, size);
      }
    }
    const segment = (fromX: number, fromY: number, toX: number, toY: number) => {
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
    };
    if (size >= 8) {
      context.strokeStyle = 'rgb(128 128 128 / 0.35)';
      context.lineWidth = 1 / dpr;
      context.beginPath();
      for (let x = 0; x <= grid.width; x++) segment(x * size, 0, x * size, fullHeight);
      for (let y = 0; y <= grid.height; y++) segment(0, y * size, fullWidth, y * size);
      context.stroke();
    }
    // Mirror axes.
    context.strokeStyle = 'rgb(255 255 255 / 0.8)';
    context.setLineDash([4, 4]);
    context.lineWidth = 1.5;
    context.beginPath();
    if (mirror.leftRight) segment(fullWidth / 2, 0, fullWidth / 2, fullHeight);
    if (mirror.topBottom) segment(0, fullHeight / 2, fullWidth, fullHeight / 2);
    context.stroke();
    context.setLineDash([]);
  }

  $effect(() => {
    void [version, grid, cellPixels, palette.join(), mirror.leftRight, mirror.topBottom];
    if (canvas) draw();
  });

  // Pointer painting: a stroke paints every cell between pointer samples.
  let lastCell: [number, number] | null = null;

  function cellAt(event: PointerEvent): [number, number] {
    const bounds = canvas.getBoundingClientRect();
    return [
      Math.floor((event.clientX - bounds.left) / cellPixels),
      Math.floor((event.clientY - bounds.top) / cellPixels),
    ];
  }

  function onPointerDown(event: PointerEvent) {
    const [x, y] = cellAt(event);
    if (tool === 'pick') {
      if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) currentSlot = grid.slots[y * grid.width + x];
      tool = 'paint';
      return;
    }
    onBeforeEdit();
    if (tool === 'fill') {
      if (floodFill(grid, x, y, currentSlot, mirror)) version++;
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    lastCell = [x, y];
    if (paintCell(grid, x, y, currentSlot, mirror)) version++;
  }

  function onPointerMove(event: PointerEvent) {
    if (!lastCell) return;
    const [x, y] = cellAt(event);
    let changed = false;
    for (const [cellX, cellY] of cellsOnLine(lastCell[0], lastCell[1], x, y)) {
      changed = paintCell(grid, cellX, cellY, currentSlot, mirror) || changed;
    }
    lastCell = [x, y];
    if (changed) version++;
  }

  function onPointerUp() {
    lastCell = null;
  }
</script>

<div class="board" bind:this={board}>
  <canvas
    bind:this={canvas}
    class:picking={tool === 'pick'}
    aria-label="Motif grid: drag to paint"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  ></canvas>
</div>

<style>
  .board {
    min-width: 0;
    min-height: 0;
    height: 100%;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--stage);
    overflow: hidden;
  }
  canvas {
    touch-action: none;
    cursor: crosshair;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.2);
  }
  canvas.picking {
    cursor: copy;
  }
</style>
