<script lang="ts">
  import { sanitizeValue, type ParamDef, type ParamValue } from '../core/params';

  /** One control for a simple parameter (number, toggle or choice). */
  let {
    def,
    value = $bindable(),
    disabled = false,
  }: { def: ParamDef; value: ParamValue; disabled?: boolean } = $props();

  const id = $props.id();

  function display(current: ParamValue): string {
    if (def.type === 'float') return Number(current).toFixed(def.step && def.step >= 0.5 ? 1 : 2);
    return String(current);
  }
</script>

<div class="field" class:disabled title={def.help}>
  {#if def.type === 'bool'}
    <label class="row" for={id}>
      <span>{def.label}</span>
      <input
        {id}
        type="checkbox"
        role="switch"
        {disabled}
        checked={value === true}
        onchange={(event) => (value = event.currentTarget.checked)}
      />
    </label>
  {:else if def.type === 'select'}
    <label for={id}>{def.label}</label>
    <select
      {id}
      {disabled}
      value={String(value)}
      onchange={(event) => (value = sanitizeValue(def, event.currentTarget.value))}
    >
      {#each def.options as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {:else if def.type === 'int' || def.type === 'float'}
    <div class="row">
      <label for={id}>{def.label}</label>
      <output for={id}>{display(value)}</output>
    </div>
    <input
      {id}
      type="range"
      {disabled}
      min={def.min}
      max={def.max}
      step={def.step ?? (def.type === 'int' ? 1 : 0.01)}
      value={Number(value)}
      oninput={(event) => (value = sanitizeValue(def, event.currentTarget.value))}
    />
  {/if}
  {#if def.help}<p class="help">{def.help}</p>{/if}
</div>

<style>
  .disabled {
    opacity: 0.45;
  }
  label {
    font-size: 0.9rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  output {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    font-size: 0.85rem;
  }
  input[type='range'] {
    width: 100%;
    min-height: 28px; /* comfortable touch target */
  }
  input[type='checkbox'] {
    width: 20px;
    height: 20px;
  }
</style>
