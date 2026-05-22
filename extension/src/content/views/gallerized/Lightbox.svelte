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

  const { store }: { store: GallerizedStore } = $props();

  const currentUrl = $derived(store.urls?.[store.lbIndex] ?? '');
  const counter = $derived(store.urls ? `${store.lbIndex + 1} / ${store.urls.length}` : '');
</script>

<div
  id="gz-lightbox"
  role="dialog"
  aria-modal="true"
  aria-label="Image lightbox"
  onclick={store.closeLightbox}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <img
    src={currentUrl}
    alt=""
    onclick={(e) => e.stopPropagation()}
  />

  <button
    class="gz-lb-nav gz-lb-prev"
    title="Previous"
    onclick={(e) => {
      e.stopPropagation();
      store.navigateLightbox(-1);
    }}
  >
    ‹
  </button>

  <button
    class="gz-lb-nav gz-lb-next"
    title="Next"
    onclick={(e) => {
      e.stopPropagation();
      store.navigateLightbox(1);
    }}
  >
    ›
  </button>

  <button
    class="gz-lb-close"
    title="Close lightbox"
    onclick={(e) => {
      e.stopPropagation();
      store.closeLightbox();
    }}
  >
    ×
  </button>

  <span class="gz-lb-counter">{counter}</span>
</div>
