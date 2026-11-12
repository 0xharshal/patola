<script lang="ts">
  import type { Design } from '../core/design';
  import { MAX_SEED, randomSeed } from '../core/rng';

  /** The design's seed: how the threads drift and bleed. */
  let { design = $bindable() }: { design: Design } = $props();
  const id = $props.id();

  function setSeed(raw: string) {
    const seed = Math.round(Number(raw));
    if (Number.isFinite(seed)) design.seed = Math.min(MAX_SEED, Math.max(0, seed));
  }
</script>

<div class="field">
  <label for={id}>Seed</label>
  <div class="button-row nowrap">
    <input
      {id}
      type="number"
      min="0"
      max={MAX_SEED}
      value={design.seed}
      onchange={(event) => setSeed(event.currentTarget.value)}
    />
    <button class="button" onclick={() => (design.seed = randomSeed())}>New seed</button>
  </div>
  <p class="help">
    The seed decides how the threads drift and bleed. The same seed always gives the same cloth. Exhibitions pick a new
    one each time they start.
  </p>
</div>
