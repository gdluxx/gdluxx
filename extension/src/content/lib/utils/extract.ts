/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { isValidUrl } from './url';

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
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[src]'));

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
        imgs = inRangeImages.map((image) => image.src);
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
      imgs = inRangeImages.map((image) => image.src);
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
      imgs = inRangeImages.map((image) => image.src);
      meta.inRangeAnchors = inRangeAnchors.length;
      meta.inRangeImages = inRangeImages.length;
    }
  }

  if (!meta.rangeApplied || (!hrefs.length && !imgs.length && !meta.startFound && !meta.endFound)) {
    hrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map(
      (anchor) => anchor.href,
    );
    imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[src]')).map(
      (image) => image.src,
    );
    meta.inRangeAnchors = hrefs.length;
    meta.inRangeImages = imgs.length;
  }

  const linkCounts: Record<string, number> = {};
  const imageCounts: Record<string, number> = {};

  for (const url of hrefs) {
    linkCounts[url] = (linkCounts[url] ?? 0) + 1;
  }
  for (const url of imgs) {
    imageCounts[url] = (imageCounts[url] ?? 0) + 1;
  }

  const links = Array.from(new Set(hrefs)).filter(isValidUrl).sort();
  const images = Array.from(new Set(imgs)).filter(isValidUrl).sort();

  return { links, images, linkCounts, imageCounts, meta };
}
