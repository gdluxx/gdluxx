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
import type { GallerizedConfig, GallerizedProfile, GallerizedTransform } from '#src/content/types';

export function profileMatches(
  key: string,
  hostname: string,
  stripped: string,
  pathname: string,
): boolean {
  if (key.startsWith('/') && key.endsWith('/')) {
    return new RegExp(key.slice(1, -1)).test(hostname + pathname);
  }
  if (key.startsWith('*.')) {
    const slashAt = key.indexOf('/', 2);
    const base = slashAt === -1 ? key.slice(2) : key.slice(2, slashAt);
    const keyPath = slashAt === -1 ? null : key.slice(slashAt);
    const hostMatch = hostname === base || hostname.endsWith('.' + base);
    return hostMatch && (keyPath === null || pathname.startsWith(keyPath));
  }
  const slashAt = key.indexOf('/');
  if (slashAt !== -1) {
    const keyHost = key.slice(0, slashAt);
    const keyPath = key.slice(slashAt);
    return (keyHost === hostname || keyHost === stripped) && pathname.startsWith(keyPath);
  }
  return key === hostname || key === stripped;
}

export function deepMerge(
  base: GallerizedConfig,
  override: GallerizedProfile['config'],
): GallerizedConfig {
  return {
    container: override.container ? { ...base.container, ...override.container } : base.container,
    images: override.images ? { ...base.images, ...override.images } : base.images,
    gallery: override.gallery ? { ...base.gallery, ...override.gallery } : base.gallery,
  };
}

export function resolveConfig(
  profiles: GallerizedProfile[],
  defaultConfig: GallerizedConfig,
): GallerizedConfig {
  const hostname = location.hostname.toLowerCase();
  const stripped = hostname.replace(/^www\./, '');
  const pathname = location.pathname;
  for (const profile of profiles) {
    if (profileMatches(profile.key, hostname, stripped, pathname)) {
      return deepMerge(defaultConfig, profile.config);
    }
  }
  return defaultConfig;
}

export function resolveUrl(raw: string): string | null {
  try {
    return new URL(raw.trim(), location.href).href;
  } catch {
    return null;
  }
}

export function applyTransform(
  url: string,
  transform: GallerizedTransform | GallerizedTransform[] | null,
): string {
  if (!transform) return url;
  const steps = Array.isArray(transform) ? transform : [transform];
  return steps.reduce((u, { find, replace }) => u.replaceAll(find, replace), url);
}

export function discoverImages(config: GallerizedConfig): string[] {
  const urls = new Set<string>();
  let containerHtml = '';
  let containerEl: Element | null = null;

  if (config.container.selector) {
    containerEl = document.querySelector(config.container.selector);
    containerHtml = containerEl ? containerEl.innerHTML : '';
  } else if (config.container.begin && config.container.end) {
    containerHtml = extr(document.body.innerHTML, config.container.begin, config.container.end);
  } else {
    containerHtml = document.body.innerHTML;
    containerEl = document.body;
  }

  if (!containerHtml) return [];

  if (config.images.selector) {
    let root: Element;
    if (containerEl) {
      root = containerEl;
    } else {
      root = document.createElement('div');
      root.innerHTML = containerHtml;
    }
    for (const el of root.querySelectorAll(config.images.selector)) {
      const raw = el.getAttribute(config.images.attr);
      if (raw) {
        const resolved = resolveUrl(raw);
        if (resolved) urls.add(applyTransform(resolved, config.images.transform));
      }
    }
  } else if (config.images.begin && config.images.end) {
    for (const raw of extrIter(containerHtml, config.images.begin, config.images.end)) {
      const resolved = resolveUrl(raw);
      if (resolved) urls.add(resolved);
    }
  }

  return [...urls];
}
