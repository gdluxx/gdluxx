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
  import { createSentHistoryStore } from '#stores/sentHistoryStore.svelte';
  import { readGalleryThumbSize } from '#utils/persistence';
  import GalleryButton from './GalleryButton.svelte';
  import GalleryModal from './GalleryModal.svelte';
  import type { GalleryDisplayConfig } from '#src/content/types';

  interface Props {
    onRegisterToggle?: (toggle: () => void) => void;
    onRegisterReinit?: (reinit: (url: string) => void) => void;
  }

  const { onRegisterToggle, onRegisterReinit }: Props = $props();

  const extractionProfiles = createExtractionProfileStore();
  const sentHistory = createSentHistoryStore();
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
      else if (store.selectMode) store.exitSelectMode();
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

  const NAV_COOLDOWN_MS = 150;
  let lastNavTs = 0;

  function normalizeDeltaY(e: WheelEvent): number {
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return e.deltaY * 16;
    if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return e.deltaY * (store.gridEl?.clientHeight ?? window.innerHeight);
    }
    return e.deltaY;
  }

  function handleWheel(e: WheelEvent): void {
    if (!store.open) return;

    if (store.lightboxOpen) {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const now = Date.now();
      if (now - lastNavTs < NAV_COOLDOWN_MS) return;
      lastNavTs = now;
      store.navigateLightbox(e.deltaY > 0 ? 1 : -1);
      return;
    }

    // Over the grid: native scrolling; overscroll-behavior contains chaining
    const overGrid = e.composedPath().some((el) => el instanceof Element && el.id === 'gz-grid');
    if (overGrid) return;

    // Anywhere else on screen: capture the wheel and scroll the grid
    e.preventDefault();
    if (store.gridEl && e.deltaY !== 0) {
      store.gridEl.scrollBy({ top: normalizeDeltaY(e) });
    }
  }

  $effect(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleGlobalClick);
    };
  });

  $effect(() => {
    if (!store.open) return;
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  });

  onMount(async () => {
    onRegisterToggle?.(() => store.toggleGallery());
    onRegisterReinit?.((url) => {
      store.closeGallery();
      void extractionProfiles.initialize(url);
      void sentHistory.initialize(new URL(url).hostname);
    });

    if (typeof window !== 'undefined') {
      await extractionProfiles.initialize(window.location.href);
      await sentHistory.initialize(window.location.hostname);

      const sizes = displayConfig.thumbSizes;
      const persisted = await readGalleryThumbSize(sizes[1]);
      store.hydrateThumbSize(sizes.includes(persisted) ? persisted : sizes[1]);
    }
  });

  $effect(() => {
    return () => sentHistory.dispose();
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
    {sentHistory}
  />
{/if}
