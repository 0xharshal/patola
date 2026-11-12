<script lang="ts" module>
  /** Stroke icons on a 24 × 24 grid. */
  const PATHS = {
    undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
    redo: ['M15 14l5-5-5-5', 'M20 9H9a5 5 0 0 0 0 10h3'],
    up: ['M6 15l6-6 6 6'],
    down: ['M6 9l6 6 6-6'],
    locked: ['M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z', 'M8 11V8a4 4 0 0 1 8 0v3'],
    unlocked: ['M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z', 'M8 11V8a4 4 0 0 1 7.5-2'],
    focus: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  } as const;

  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
  {#each PATHS[name] as path (path)}<path d={path} />{/each}
</svg>
