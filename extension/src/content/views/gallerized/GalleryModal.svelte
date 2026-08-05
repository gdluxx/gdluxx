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
  import type { SentHistoryStore } from '#stores/sentHistoryStore.svelte';
  import type { GalleryDisplayConfig } from '#src/content/types';

  const {
    store,
    displayConfig,
    sentHistory,
  }: {
    store: GallerizedStore;
    displayConfig: GalleryDisplayConfig;
    sentHistory: SentHistoryStore;
  } = $props();

  const urlCount = $derived(store.urls?.length ?? 0);
  const title = $derived(
    `Gallerized — ${urlCount} image${urlCount !== 1 ? 's' : ''}` +
      (store.selectMode ? ` — ${store.selected.size} selected` : ''),
  );
  const thumbPx = $derived(`${store.activeThumbSize}px`);
  const gapPx = $derived(`${displayConfig.gap}px`);
  const borderPx = $derived(`${displayConfig.border}px`);

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
    <div class="gz-header-actions">
      {#if !store.selectMode}
        <button
          class="gz-header-btn"
          onclick={() => store.enterSelectMode()}
        >
          Select
        </button>
      {:else}
        <button
          class="gz-header-btn"
          onclick={() => store.selectAllVisible()}
        >
          All
        </button>
        <button
          class="gz-header-btn"
          onclick={() => store.selectNoneVisible()}
        >
          None
        </button>
        <button
          class="gz-header-btn"
          disabled={store.selected.size === 0 || store.sending}
          onclick={() => void store.sendSelected()}
        >
          Send {store.selected.size}
        </button>
        <button
          class="gz-header-btn"
          onclick={() => store.exitSelectMode()}
        >
          Done
        </button>
      {/if}
    </div>
    <button
      class="gz-header-close"
      title="Close gallery"
      onclick={store.closeGallery}
    >
      ×
    </button>
  </div>

  <div
    id="gz-grid"
    bind:this={store.gridEl}
  >
    {#each store.urls ?? [] as url, i (url)}
      <div
        class="gz-cell"
        class:gz-cell-selected={store.selected.has(url)}
        role="button"
        tabindex="0"
        aria-pressed={store.selectMode ? store.selected.has(url) : undefined}
        onclick={() => (store.selectMode ? store.toggleSelected(url) : store.openLightbox(i))}
        onkeydown={(e) =>
          e.key === 'Enter' &&
          (store.selectMode ? store.toggleSelected(url) : store.openLightbox(i))}
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
        {#if store.selectMode}
          <span
            class="gz-check"
            class:gz-check-on={store.selected.has(url)}
            aria-hidden="true"
          >
            ✓
          </span>
        {/if}
        {#if sentHistory.enabled && sentHistory.statuses.has(url)}
          <span class="gz-sent-dot gz-sent-{sentHistory.statuses.get(url)}"></span>
        {/if}
        <span class="gz-idx">{i + 1}</span>
      </div>
    {/each}
  </div>

  {#if store.lightboxOpen}
    <Lightbox {store} />
  {/if}
</div>
