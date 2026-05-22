/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { loadGallerizedSettings } from '#utils/gallerizedStorage';
import { resolveConfig, discoverImages } from '#utils/gallerizedUtils';
import type { GallerizedSettings } from '#src/content/types';

export function createGallerizedStore() {
  let urls = $state<string[] | null>(null);
  let lbIndex = $state(0);
  let open = $state(false);
  let lightboxOpen = $state(false);
  let activeThumbSize = $state(200);
  let sdOpen = $state(false);
  let settings = $state<GallerizedSettings | null>(null);

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
    get settings() {
      return settings;
    },

    async loadSettings(): Promise<void> {
      settings = await loadGallerizedSettings();
      activeThumbSize = settings.defaultConfig.gallery.thumbSizes[1];
    },

    updateSettings(s: GallerizedSettings): void {
      settings = s;
      activeThumbSize = s.defaultConfig.gallery.thumbSizes[1];
    },

    toggleGallery(): void {
      if (!settings) return;
      if (urls === null) {
        const config = resolveConfig(settings.profiles, settings.defaultConfig);
        urls = discoverImages(config);
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
    },

    toggleSd(): void {
      sdOpen = !sdOpen;
    },

    closeSd(): void {
      sdOpen = false;
    },
  };
}

export type GallerizedStore = ReturnType<typeof createGallerizedStore>;
