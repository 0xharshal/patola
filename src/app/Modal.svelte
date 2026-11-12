<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  /**
   * A modal dialog that opens as soon as it is shown. Keys pressed inside it
   * stay inside (so Ctrl+Z here doesn't undo the design). On phones,
   * `fullScreenOnPhone` dialogs take the whole screen.
   */
  let {
    labelledBy,
    width,
    height = 'auto',
    fullScreenOnPhone = false,
    onClose,
    onCancel,
    onKeydown,
    children,
  }: {
    /** id of the dialog's heading. */
    labelledBy: string;
    width: string;
    height?: string;
    fullScreenOnPhone?: boolean;
    onClose: () => void;
    /** Esc pressed; call `event.preventDefault()` to keep the dialog open. */
    onCancel?: (event: Event) => void;
    onKeydown?: (event: KeyboardEvent) => void;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;

  onMount(() => dialog.showModal());

  export function close() {
    dialog.close();
  }

  function keydown(event: KeyboardEvent) {
    onKeydown?.(event);
    event.stopPropagation();
  }
</script>

<dialog
  bind:this={dialog}
  class:full-screen-on-phone={fullScreenOnPhone}
  style:--modal-width={width}
  style:--modal-height={height}
  aria-labelledby={labelledBy}
  onclose={onClose}
  oncancel={onCancel}
  onkeydown={keydown}
>
  {@render children()}
</dialog>

<style>
  dialog {
    width: var(--modal-width);
    height: var(--modal-height);
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--panel);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  @media (max-width: 760px) {
    .full-screen-on-phone {
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
      border-radius: 0;
    }
  }
</style>
