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
  import browser from 'webextension-polyfill';
  import { createGallerizedStore } from '#stores/gallerizedStore.svelte';
  import { GALLERIZED_STORAGE_KEY } from '#utils/gallerizedStorage';
  import GalleryButton from './GalleryButton.svelte';
  import GalleryModal from './GalleryModal.svelte';
  import type { GallerizedSettings } from '#src/content/types';

  const store = createGallerizedStore();

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

  function onStorageChanged(
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ): void {
    if (area !== 'local') return;
    if (GALLERIZED_STORAGE_KEY in changes) {
      const newSettings = changes[GALLERIZED_STORAGE_KEY].newValue as
        | GallerizedSettings
        | undefined;
      if (newSettings) store.updateSettings(newSettings);
    }
  }

  onMount(async () => {
    await store.loadSettings();

    browser.storage.onChanged.addListener(onStorageChanged);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleGlobalClick);

    return () => {
      browser.storage.onChanged.removeListener(onStorageChanged);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleGlobalClick);
    };
  });
</script>

<GalleryButton {store} />
{#if store.open}
  <GalleryModal {store} />
{/if}
