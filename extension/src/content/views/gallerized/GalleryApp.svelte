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
  import { onMount } from 'svelte';
  import { createGallerizedStore } from '#stores/gallerizedStore.svelte';
  import { createExtractionProfileStore } from '#stores/extractionProfileStore.svelte';
  import { readGalleryThumbSize } from '#utils/persistence';
  import GalleryButton from './GalleryButton.svelte';
  import GalleryModal from './GalleryModal.svelte';
  import type { GalleryDisplayConfig } from '#src/content/types';

  const extractionProfiles = createExtractionProfileStore();
  const store = createGallerizedStore(
    () => extractionProfiles.extraction,
    () => extractionProfiles.rules,
  );

  const displayConfig: GalleryDisplayConfig = $derived(
    extractionProfiles.activeProfile?.gallery ?? extractionProfiles.galleryDefaults,
  );

  // Invalidate cached URLs whenever extraction config or rules change so the
  // next toggleGallery() always rediscovers with the current config.
  $effect(() => {
    void extractionProfiles.extraction;
    void extractionProfiles.rules;
    store.clearUrls();
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (!store.open) return;
    if (e.key === 'Escape') {
      if (store.lightboxOpen) store.closeLightbox();
      else store.closeGallery();
      return;
    }
    if (store.lightboxOpen) {
      if (e.key === 'ArrowLeft') store.navigateLightbox(-1);
      if (e.key === 'ArrowRight') store.navigateLightbox(1);
    }
  }

  function handleGlobalClick(e: MouseEvent): void {
    if (!store.sdOpen) return;
    const path = e.composedPath();
    const insideSd = path.some((el) => el instanceof Element && el.id === 'gz-sd');
    if (!insideSd) store.closeSd();
  }

  onMount(async () => {
    if (typeof window !== 'undefined') {
      await extractionProfiles.initialize(window.location.href);

      const sizes = displayConfig.thumbSizes;
      const persisted = await readGalleryThumbSize(sizes[1]);
      store.hydrateThumbSize(sizes.includes(persisted) ? persisted : sizes[1]);
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleGlobalClick);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleGlobalClick);
    };
  });
</script>

<GalleryButton
  {store}
  {displayConfig}
/>
{#if store.open}
  <GalleryModal
    {store}
    {displayConfig}
  />
{/if}
