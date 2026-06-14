<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import type { GallerizedStore } from '#stores/gallerizedStore.svelte';
  import type { GalleryDisplayConfig } from '#src/content/types';

  const { store, displayConfig }: { store: GallerizedStore; displayConfig: GalleryDisplayConfig } =
    $props();

  const corner = $derived(displayConfig.buttonCorner);
  const vEdge = $derived(corner.startsWith('top') ? 'top' : 'bottom');
  const hEdge = $derived(corner.endsWith('left') ? 'left' : 'right');
  const thumbSizes = $derived(displayConfig.thumbSizes);
</script>

<div
  id="gz-controls"
  style="{vEdge}: 18px; {hEdge}: 18px; {vEdge === 'top' ? 'align-items: flex-start;' : ''}"
>
  <div id="gz-sd">
    {#if store.sdOpen}
      <div
        id="gz-sd-popup"
        style={vEdge === 'top' ? 'bottom: auto; top: calc(100% + 6px);' : ''}
      >
        {#each thumbSizes as size (size)}
          <button
            class="gz-sd-item {store.activeThumbSize === size ? 'gz-sd-active' : ''}"
            onclick={(e) => {
              e.stopPropagation();
              store.setThumbSize(size);
              store.closeSd();
            }}
          >
            {size}px
          </button>
        {/each}
      </div>
    {/if}
    <button
      id="gz-sd-btn"
      title="Thumbnail size"
      onclick={(e) => {
        e.stopPropagation();
        store.toggleSd();
      }}
    >
      ⊞
    </button>
  </div>

  <button
    id="gz-btn"
    onclick={() => {
      store.closeSd();
      store.toggleGallery();
    }}
  >
    {#if store.open}
      × Close
    {:else}
      🖼 Gallery
    {/if}
    {#if store.urls !== null}
      <span class="gz-badge">{store.urls.length}</span>
    {/if}
  </button>
</div>
