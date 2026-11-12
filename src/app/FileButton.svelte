<script lang="ts">
  /** A button that opens the file picker and hands over the chosen file. */
  let { label, accept, onFile }: { label: string; accept: string; onFile: (file: File) => void } = $props();

  function pick(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = ''; // so picking the same file again still fires
    if (file) onFile(file);
  }
</script>

<label class="button file-button">
  {label}
  <input type="file" {accept} onchange={pick} />
</label>

<style>
  .file-button {
    position: relative;
    cursor: pointer;
  }
  .file-button input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .file-button:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
