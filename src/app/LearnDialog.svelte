<script lang="ts">
  import Modal from './Modal.svelte';
  import { GUIDE, type GuideAction } from '../education/guide';

  /** The educational guide. Its buttons change the design so the reader can see what they read about. */
  let { onAction, onClose }: { onAction: (action: GuideAction) => void; onClose: () => void } = $props();

  let modal: ReturnType<typeof Modal>;
  let sectionId = $state(GUIDE[0].id);
  const section = $derived(GUIDE.find((candidate) => candidate.id === sectionId) ?? GUIDE[0]);

  function run(action: GuideAction) {
    onAction(action);
    modal.close(); // show the result
  }
</script>

<Modal
  bind:this={modal}
  labelledBy="learn-title"
  width="min(900px, 96vw)"
  height="min(680px, 90dvh)"
  fullScreenOnPhone
  {onClose}
>
  <div class="layout">
    <header>
      <h2 id="learn-title">Learn about patola</h2>
      <button class="button" onclick={() => modal.close()}>Close</button>
    </header>
    <nav aria-label="Topics">
      {#each GUIDE as topic (topic.id)}
        <button
          class="topic"
          aria-current={topic.id === section.id ? 'true' : undefined}
          onclick={() => (sectionId = topic.id)}>{topic.title}</button
        >
      {/each}
    </nav>
    <article>
      <h3>{section.title}</h3>
      {#each section.paragraphs as paragraph (paragraph)}<p>{paragraph}</p>{/each}
      {#if section.actions}
        <div class="button-row">
          {#each section.actions as { label, action } (label)}
            <button class="button primary" onclick={() => run(action)}>{label}</button>
          {/each}
        </div>
      {/if}
      {#if section.items}
        <dl>
          {#each section.items as item (item.title)}
            <div class="item">
              <dt>{item.title}</dt>
              <dd>
                {item.text}
                {#if item.action}
                  {@const action = item.action.action}
                  <button class="button" onclick={() => run(action)}>{item.action.label}</button>
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      {/if}
    </article>
  </div>
</Modal>

<style>
  .layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }
  header {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    border-right: 1px solid var(--line);
    overflow-y: auto;
  }
  .topic {
    text-align: left;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
  }
  .topic[aria-current='true'] {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    font-weight: 600;
  }
  article {
    padding: 18px 22px;
    overflow-y: auto;
    line-height: 1.55;
  }
  h3 {
    margin: 0 0 8px;
  }
  p {
    margin: 0 0 12px;
  }
  dl {
    margin: 16px 0 0;
    display: grid;
    gap: 14px;
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 2px 0 0;
    color: var(--muted);
  }
  dd .button {
    margin-top: 6px;
    display: flex;
    width: fit-content;
  }

  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto minmax(0, 1fr);
    }
    nav {
      flex-direction: row;
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .topic {
      white-space: nowrap;
    }
  }
</style>
