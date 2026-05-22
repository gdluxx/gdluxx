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
  import Lightbox from './Lightbox.svelte';
  import type { GallerizedStore } from '#stores/gallerizedStore.svelte';

  const { store }: { store: GallerizedStore } = $props();

  const urlCount = $derived(store.urls?.length ?? 0);
  const title = $derived(`Gallerized — ${urlCount} image${urlCount !== 1 ? 's' : ''}`);
  const thumbPx = $derived(`${store.activeThumbSize}px`);
  const gapPx = $derived(`${store.settings?.defaultConfig.gallery.gap ?? 12}px`);
  const borderPx = $derived(`${store.settings?.defaultConfig.gallery.border ?? 30}px`);

  function onCellLoad(img: HTMLImageElement) {
    img.classList.remove('gz-loading');
  }

  function onCellError(img: HTMLImageElement, cell: HTMLDivElement) {
    img.style.display = 'none';
    cell.style.background = '#1a0a0a';
  }
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="gz-overlay"
  onclick={store.closeGallery}
></div>

<!-- Modal -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="gz-modal"
  style="--gz-thumb: {thumbPx}; --gz-gap: {gapPx}; --gz-border: {borderPx};"
  onclick={(e) => e.stopPropagation()}
>
  <div id="gz-header">
    <span class="gz-title">{title}</span>
    <button
      class="gz-header-close"
      title="Close gallery"
      onclick={store.closeGallery}
    >
      ×
    </button>
  </div>

  <div id="gz-grid">
    {#each store.urls ?? [] as url, i (url)}
      <div
        class="gz-cell"
        role="button"
        tabindex="0"
        onclick={() => store.openLightbox(i)}
        onkeydown={(e) => e.key === 'Enter' && store.openLightbox(i)}
      >
        <img
          class="gz-loading"
          src={url}
          alt=""
          loading="lazy"
          onload={(e) => onCellLoad(e.currentTarget as HTMLImageElement)}
          onerror={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            const c = img.closest('.gz-cell') as HTMLDivElement;
            onCellError(img, c);
          }}
        />
        <span class="gz-idx">{i + 1}</span>
      </div>
    {/each}
  </div>

  {#if store.lightboxOpen}
    <Lightbox {store} />
  {/if}
</div>
