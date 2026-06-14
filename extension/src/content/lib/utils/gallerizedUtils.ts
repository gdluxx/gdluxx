/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { extr, extrIter } from './gallerizedExtract';
import { extractAll } from './extract';
import type { ExtractionConfig, TargetedExtractionConfig } from '#src/content/types';

export function resolveUrl(raw: string): string | null {
  try {
    return new URL(raw.trim(), location.href).href;
  } catch {
    return null;
  }
}

export function discoverImages(config: ExtractionConfig): string[] {
  if (config.mode === 'range') {
    return extractAll(config.startSelector, config.endSelector).images;
  }
  return discoverTargetedImages(config);
}

function discoverTargetedImages(config: TargetedExtractionConfig): string[] {
  const urls = new Set<string>();
  let containerHtml = '';
  let containerEl: Element | null = null;

  const { container } = config;
  if (container.via === 'body') {
    containerHtml = document.body.innerHTML;
    containerEl = document.body;
  } else if (container.via === 'selector') {
    try {
      containerEl = document.querySelector(container.selector);
    } catch {
      return [];
    }
    containerHtml = containerEl ? containerEl.innerHTML : '';
  } else {
    containerHtml = extr(document.body.innerHTML, container.begin, container.end);
  }

  if (!containerHtml) return [];

  const { images } = config;
  if (images.via === 'selector') {
    let root: Element;
    if (containerEl) {
      root = containerEl;
    } else {
      root = document.createElement('div');
      root.innerHTML = containerHtml;
    }
    try {
      for (const el of root.querySelectorAll(images.selector)) {
        const raw = el.getAttribute(images.attr);
        if (raw) {
          const resolved = resolveUrl(raw);
          if (resolved) urls.add(resolved);
        }
      }
    } catch {
      return [];
    }
  } else {
    for (const raw of extrIter(containerHtml, images.begin, images.end)) {
      const resolved = resolveUrl(raw);
      if (resolved) urls.add(resolved);
    }
  }

  return [...urls];
}
