<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A collapsible section of the control panel. */
  let { title, open = true, children }: { title: string; open?: boolean; children: Snippet } = $props();
</script>

<details {open}>
  <summary>{title}</summary>
  <div class="section">
    {@render children()}
  </div>
</details>

<style>
  details {
    border-bottom: 1px solid var(--line);
  }
  summary {
    padding: 12px 0;
    font-weight: 600;
    cursor: pointer;
  }
  .section {
    display: grid;
    gap: 14px;
    padding-bottom: 16px;
  }
</style>
