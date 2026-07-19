/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { discoverImages } from '#utils/gallerizedUtils';
import { persistGalleryThumbSize } from '#utils/persistence';
import { DEFAULT_GALLERY_CONFIG } from '#utils/storageExtractionProfiles';
import { applySubRules } from '#utils/substitution';
import type { ExtractionConfig } from '#src/content/types';
import type { SubRule } from '#utils/substitution';

export function createGallerizedStore(
  getExtraction: () => ExtractionConfig,
  getRules: () => SubRule[],
) {
  let urls = $state<string[] | null>(null);
  let lbIndex = $state(0);
  let open = $state(false);
  let lightboxOpen = $state(false);
  let activeThumbSize = $state(DEFAULT_GALLERY_CONFIG.thumbSizes[1]);
  let sdOpen = $state(false);

  return {
    get urls() {
      return urls;
    },
    get lbIndex() {
      return lbIndex;
    },
    get open() {
      return open;
    },
    get lightboxOpen() {
      return lightboxOpen;
    },
    get activeThumbSize() {
      return activeThumbSize;
    },
    get sdOpen() {
      return sdOpen;
    },

    toggleGallery(): void {
      if (urls === null) {
        const discovered = discoverImages(getExtraction());
        const rules = getRules();
        urls =
          rules.length > 0
            ? discovered.map((url) => {
                const result = applySubRules(url, rules);
                return result.modified ? result.modifiedUrl : url;
              })
            : discovered;
      }
      open = !open;
      if (!open) lightboxOpen = false;
    },

    closeGallery(): void {
      open = false;
      lightboxOpen = false;
    },

    openLightbox(i: number): void {
      lbIndex = i;
      lightboxOpen = true;
    },

    closeLightbox(): void {
      lightboxOpen = false;
    },

    navigateLightbox(delta: number): void {
      if (!urls) return;
      lbIndex = (lbIndex + delta + urls.length) % urls.length;
    },

    setThumbSize(size: number): void {
      activeThumbSize = size;
      void persistGalleryThumbSize(size);
    },

    hydrateThumbSize(size: number): void {
      activeThumbSize = size;
    },

    toggleSd(): void {
      sdOpen = !sdOpen;
    },

    closeSd(): void {
      sdOpen = false;
    },

    clearUrls(): void {
      urls = null;
    },
  };
}

export type GallerizedStore = ReturnType<typeof createGallerizedStore>;
