/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { SvelteSet } from 'svelte/reactivity';
import { discoverImages } from '#utils/gallerizedUtils';
import { loadSiteDirectory, persistGalleryThumbSize } from '#utils/persistence';
import { sendUrls } from '#utils/gdluxxApi';
import { DEFAULT_GALLERY_CONFIG } from '#utils/storageExtractionProfiles';
import { applySubRules } from '#utils/substitution';
import type { ExtractionConfig } from '#src/content/types';
import type { SubRule } from '#utils/substitution';
import browser from 'webextension-polyfill';

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
  let selectMode = $state(false);
  const selected = new SvelteSet<string>();
  let sending = $state(false);

  // Plain reference no rune: only read imperatively by the wheel handler
  let gridEl: HTMLDivElement | null = null;

  function notify(message: string): void {
    void browser.runtime
      .sendMessage({ action: 'showNotification', title: 'gdluxx Extension', message })
      .catch(() => {
        // Best-effort notification; nothing actionable if the background
        // script is unreachable
      });
  }

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
    get selectMode() {
      return selectMode;
    },
    get selected() {
      return selected;
    },
    get sending() {
      return sending;
    },
    get gridEl() {
      return gridEl;
    },
    set gridEl(el: HTMLDivElement | null) {
      gridEl = el;
    },

    toggleGallery(): void {
      if (urls === null) {
        const discovered = discoverImages(getExtraction());
        const rules = getRules();
        const mapped =
          rules.length > 0
            ? discovered.map((url) => {
                const result = applySubRules(url, rules);
                return result.modified ? result.modifiedUrl : url;
              })
            : discovered;
        urls = [...new SvelteSet(mapped)];
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
      lightboxOpen = false;
      selected.clear();
      selectMode = false;
    },

    enterSelectMode(): void {
      selectMode = true;
    },

    exitSelectMode(): void {
      selectMode = false;
      selected.clear();
    },

    toggleSelectMode(): void {
      if (selectMode) {
        selectMode = false;
        selected.clear();
      } else {
        selectMode = true;
      }
    },

    toggleSelected(url: string): void {
      if (selected.has(url)) selected.delete(url);
      else selected.add(url);
    },

    selectAllVisible(): void {
      for (const url of urls ?? []) selected.add(url);
    },

    selectNoneVisible(): void {
      selected.clear();
    },

    async sendSelected(): Promise<void> {
      if (sending) return;
      const targets = [...selected];
      if (targets.length === 0) return;

      if (!window.confirm(`Send ${targets.length} image(s) to gdluxx for processing?`)) return;

      sending = true;
      try {
        const siteDir = await loadSiteDirectory();
        const siteDirectory = siteDir.enabled ? window.location.hostname : undefined;

        const result = await sendUrls(targets, undefined, siteDirectory);
        if (result.success) {
          notify(
            result.message ??
              `Sent ${targets.length} image${targets.length === 1 ? '' : 's'} to gdluxx`,
          );
          selectMode = false;
          selected.clear();
        } else {
          notify(result.error ?? 'Failed to send images to gdluxx');
        }
      } catch (error) {
        console.error('gdluxx: gallery send failed', error);
        notify('Failed to send image(s) to gdluxx');
      } finally {
        sending = false;
      }
    },

    async sendOne(url: string): Promise<void> {
      if (sending) return;
      if (!url) return;

      sending = true;
      try {
        const siteDir = await loadSiteDirectory();
        const siteDirectory = siteDir.enabled ? window.location.hostname : undefined;

        const result = await sendUrls([url], undefined, siteDirectory);
        if (result.success) {
          notify(result.message ?? 'Sent image to gdluxx');
        } else {
          notify(result.error ?? 'Failed to send image to gdluxx');
        }
      } catch (error) {
        console.error('gdluxx: gallery send failed', error);
        notify('Failed to send image(s) to gdluxx');
      } finally {
        sending = false;
      }
    },
  };
}

export type GallerizedStore = ReturnType<typeof createGallerizedStore>;
