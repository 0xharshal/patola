<script lang="ts">
  import { onMount } from 'svelte';
  import { isTrusted, latestState, onCodeResult, trustCode, TIME_LIMIT_MS } from '../custom/codeRunner';
  import { EXAMPLE_CODE } from '../generators/customCode';

  /** Editor for the custom code generator. Code is applied (and trusted) only when you press Run. */
  let { value = $bindable() }: { value: string } = $props();

  const id = $props.id();
  let draft = $state(value);
  let resultVersion = $state(0);

  // Undo, redo or a new link can replace the code: show it.
  let lastApplied = value;
  $effect(() => {
    if (value !== lastApplied) {
      draft = value;
      lastApplied = value;
    }
  });

  onMount(() => onCodeResult(() => resultVersion++));

  const trusted = $derived(resultVersion >= 0 && isTrusted(value));
  const runState = $derived(resultVersion >= 0 ? latestState(value) : null);
  const changed = $derived(draft !== value);

  function run() {
    trustCode(draft);
    lastApplied = draft;
    value = draft;
  }

  function onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  }
</script>

<div class="field">
  <label for={id}>Code</label>
  {#if !trusted && !changed}
    <p class="notice">
      This code came with a link. Read it first: it only runs after you press <strong>Run</strong>.
    </p>
  {/if}
  <textarea {id} bind:value={draft} rows="14" spellcheck="false" autocapitalize="off" onkeydown={onKeydown}></textarea>
  <div class="button-row">
    <button class="button primary" onclick={run}>Run{changed ? ' changes' : ''}</button>
    <button class="button" onclick={() => (draft = EXAMPLE_CODE)}>Example</button>
  </div>
  <p class="help" aria-live="polite">
    {#if runState?.status === 'error'}
      <span class="problem">{runState.message}</span>
    {:else if runState?.status === 'running'}
      Running…
    {:else}
      Ctrl+Enter runs. Each run is stopped after {TIME_LIMIT_MS / 1000} s.
    {/if}
  </p>
</div>

<style>
  textarea {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.8rem;
    line-height: 1.45;
    resize: vertical;
    white-space: pre;
    tab-size: 2;
  }
  .notice {
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    font-size: 0.85rem;
  }
  .problem {
    color: #c0392b;
  }
</style>
