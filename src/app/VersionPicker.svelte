<script lang="ts">
  import { onMount } from 'svelte';
  import {
    APP_VERSION,
    loadVersionIndex,
    releaseUrl,
    SOURCE_CODE_URL,
    siteLocation,
    type VersionIndex,
  } from './versions';

  /** Shows this build's version and, on the published site, lets you open any released version. */
  const site = siteLocation(location.pathname);
  const id = $props.id();
  let index: VersionIndex | null = $state(null);

  onMount(async () => {
    index = await loadVersionIndex(site);
  });

  /** Open a release with the current design (null = newest, at the site root). */
  function open(release: string) {
    location.href = releaseUrl(site, release || null, location.search);
  }
</script>

<div class="field version">
  {#if index && index.versions.length > 1}
    <label for={id}>Version</label>
    <select {id} value={site.release ?? ''} onchange={(event) => open(event.currentTarget.value)}>
      <option value="">Newest{index.latest ? ` (${index.latest})` : ''}</option>
      {#each index.versions as version (version)}
        <option value={version}>{version}</option>
      {/each}
    </select>
    <p class="help">
      {site.release
        ? `You are using ${site.release}. It stays as it is; newer versions don't change it.`
        : `You are using ${APP_VERSION}, the newest version. Older versions keep working; your design opens in the version you pick.`}
    </p>
  {:else}
    <p class="help">Version {APP_VERSION}</p>
  {/if}
  <p class="help">
    Free software (GPL). <a href={SOURCE_CODE_URL} target="_blank" rel="noopener">Source code on GitHub</a>
  </p>
</div>

<style>
  .version {
    padding-top: 12px;
  }
</style>
