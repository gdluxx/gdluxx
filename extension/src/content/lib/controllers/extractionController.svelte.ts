/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { AppTab } from '#src/content/types';
import type { SelectionStore } from '#stores/selectionStore.svelte';
import { extractAll } from '#utils/extract';

export function createExtractionController(
  selection: SelectionStore,
  clearSubstitutionModifications: () => void,
  getActiveTab: () => AppTab,
  getSelectors: () => { startSel: string; endSel: string },
) {
  let links = $state<string[]>([]);
  let images = $state<string[]>([]);
  let linkCounts = $state<Record<string, number>>({});
  let imageCounts = $state<Record<string, number>>({});
  let rangeHint = $state('');

  function populate() {
    const { startSel, endSel } = getSelectors();
    const {
      links: l,
      images: i,
      linkCounts: lc,
      imageCounts: ic,
      meta,
    } = extractAll(startSel.trim(), endSel.trim());
    links = l;
    images = i;
    linkCounts = lc;
    imageCounts = ic;
    selection.selectNone();
    clearSubstitutionModifications();
    if (meta.rangeApplied) {
      if (!meta.startFound && !meta.endFound) {
        rangeHint = 'Range: selectors not found';
      } else if (!meta.startFound) {
        rangeHint = 'Range: start selector not found';
      } else if (!meta.endFound) {
        rangeHint = 'Range: end selector not found';
      } else if (meta.startBeforeEnd === false) {
        rangeHint = 'Range: start appears after end';
      } else {
        rangeHint = `Range: ${meta.inRangeAnchors} links, ${meta.inRangeImages} images scanned`;
      }
    } else {
      rangeHint = '';
    }
  }

  const filteredLinks = $derived(() =>
    !selection.filter
      ? links
      : links.filter((u) => u.toLowerCase().includes(selection.filter.toLowerCase())),
  );

  const filteredImages = $derived(() =>
    !selection.filter
      ? images
      : images.filter((u) => u.toLowerCase().includes(selection.filter.toLowerCase())),
  );

  const visible = $derived(() => {
    const active = getActiveTab();
    return active === 'links' ? filteredLinks() : active === 'images' ? filteredImages() : [];
  });

  return {
    get links() {
      return links;
    },
    get images() {
      return images;
    },
    get linkCounts() {
      return linkCounts;
    },
    get imageCounts() {
      return imageCounts;
    },
    get rangeHint() {
      return rangeHint;
    },
    get filteredLinks() {
      return filteredLinks();
    },
    get filteredImages() {
      return filteredImages();
    },
    get visible() {
      return visible();
    },
    populate,
    setData(next: {
      links: string[];
      images: string[];
      linkCounts: Record<string, number>;
      imageCounts: Record<string, number>;
    }) {
      links = next.links;
      images = next.images;
      linkCounts = next.linkCounts;
      imageCounts = next.imageCounts;
    },
  } as const;
}

export type ExtractionController = ReturnType<typeof createExtractionController>;
