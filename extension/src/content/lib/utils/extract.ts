/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { normalizeUrl } from './url';

export interface ExtractMeta {
  rangeApplied: boolean;
  startFound: boolean;
  endFound: boolean;
  startBeforeEnd?: boolean;
  inRangeAnchors: number;
  inRangeImages: number;
}

export interface ExtractResult {
  links: string[];
  images: string[];
  linkCounts: Record<string, number>;
  imageCounts: Record<string, number>;
  meta: ExtractMeta;
}

export function extractAll(startSelector = '', endSelector = ''): ExtractResult {
  let hrefs: string[] = [];
  let imgs: string[] = [];
  const linkCounts: Record<string, number> = {};
  const imageCounts: Record<string, number> = {};

  const meta: ExtractMeta = {
    rangeApplied: !!(startSelector || endSelector),
    startFound: !startSelector,
    endFound: !endSelector,
    startBeforeEnd: undefined,
    inRangeAnchors: 0,
    inRangeImages: 0,
  };

  if (meta.rangeApplied) {
    const start = startSelector ? document.querySelector(startSelector) : null;
    const end = endSelector ? document.querySelector(endSelector) : null;
    if (startSelector) meta.startFound = !!start;
    if (endSelector) meta.endFound = !!end;

    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('img'));

    if (start && end) {
      const startPrecedesEnd = !!(
        start.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING
      );
      meta.startBeforeEnd = startPrecedesEnd;

      if (startPrecedesEnd) {
        const inRangeAnchors = anchors.filter((anchor) => {
          const startToAnchor =
            start.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING;
          const anchorToEnd =
            anchor.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING;
          return startToAnchor !== 0 && anchorToEnd !== 0;
        });

        const inRangeImages = images.filter((image) => {
          const startToImage =
            start.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING;
          const imageToEnd = image.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING;
          return startToImage !== 0 && imageToEnd !== 0;
        });

        hrefs = inRangeAnchors.map((anchor) => anchor.href);
        imgs = collectImageUrls(inRangeImages);
        meta.inRangeAnchors = inRangeAnchors.length;
        meta.inRangeImages = inRangeImages.length;
      }
    } else if (start) {
      const inRangeAnchors = anchors.filter(
        (anchor) =>
          (start.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      );
      const inRangeImages = images.filter(
        (image) => (start.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      );
      hrefs = inRangeAnchors.map((anchor) => anchor.href);
      imgs = collectImageUrls(inRangeImages);
      meta.inRangeAnchors = inRangeAnchors.length;
      meta.inRangeImages = inRangeImages.length;
    } else if (end) {
      const inRangeAnchors = anchors.filter(
        (anchor) => (anchor.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      );
      const inRangeImages = images.filter(
        (image) => (image.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      );
      hrefs = inRangeAnchors.map((anchor) => anchor.href);
      imgs = collectImageUrls(inRangeImages);
      meta.inRangeAnchors = inRangeAnchors.length;
      meta.inRangeImages = inRangeImages.length;
    }
  }

  const needsFallback =
    !meta.rangeApplied ||
    !hrefs.length && !imgs.length ||
    (meta.rangeApplied && (!meta.startFound || !meta.endFound || meta.startBeforeEnd === false));

  if (needsFallback) {
    hrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map(
      (anchor) => anchor.href,
    );
    imgs = collectImageUrls(Array.from(document.querySelectorAll<HTMLImageElement>('img')));
    meta.inRangeAnchors = hrefs.length;
    meta.inRangeImages = imgs.length;
  }

  const normalizedLinks: string[] = [];
  const normalizedImages: string[] = [];

  for (const url of hrefs) {
    const normalized = normalizeUrl(url);
    if (!normalized) continue;
    linkCounts[normalized] = (linkCounts[normalized] ?? 0) + 1;
    normalizedLinks.push(normalized);
  }
  for (const url of imgs) {
    const normalized = normalizeUrl(url);
    if (!normalized) continue;
    imageCounts[normalized] = (imageCounts[normalized] ?? 0) + 1;
    normalizedImages.push(normalized);
  }

  const links = Array.from(new Set(normalizedLinks)).sort();
  const images = Array.from(new Set(normalizedImages)).sort();

  return { links, images, linkCounts, imageCounts, meta };
}

function collectImageUrls(images: HTMLImageElement[]): string[] {
  const urls: string[] = [];
  for (const image of images) {
    if (image.src) urls.push(image.src);
    if (image.currentSrc && image.currentSrc !== image.src) urls.push(image.currentSrc);
    if (image.srcset) {
      urls.push(...parseSrcSet(image.srcset));
    }
    const dataSrc = image.getAttribute('data-src') ?? image.dataset.src;
    if (dataSrc) urls.push(dataSrc);
    const dataSrcSet = image.getAttribute('data-srcset') ?? image.dataset.srcset;
    if (dataSrcSet) {
      urls.push(...parseSrcSet(dataSrcSet));
    }
    const dataLazy = image.getAttribute('data-lazy');
    if (dataLazy) urls.push(dataLazy);
    const dataOriginal = image.getAttribute('data-original');
    if (dataOriginal) urls.push(dataOriginal);
  }
  return urls;
}

function parseSrcSet(srcset: string): string[] {
  return srcset
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}
