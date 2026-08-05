/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { resolveUrl } from '#utils/gallerizedUtils';
import type { TargetedExtractionConfig } from '#src/content/types';

const MAX_ACCUMULATED_URLS = 5000;
const DEBOUNCE_MS = 300;
const MAX_WAIT_MS = 1000;
const ATTRIBUTE_FILTER = ['src', 'srcset', 'data-src', 'data-srcset', 'data-lazy', 'data-original'];

let urls = new Set<string>();
let activeConfigJson: string | null = null;
let currentConfig: TargetedExtractionConfig | null = null;
let observer: MutationObserver | null = null;
let containerEl: Element | null = null;
const listeners = new Set<() => void>();
let pendingRecords: MutationRecord[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let firstQueuedAt: number | null = null;
let fallbackObserver: MutationObserver | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let capWarned = false;
let unsupportedWarned = false;

function notify(): void {
  queueMicrotask(() => {
    for (const cb of listeners) cb();
  });
}

function warnCapOnce(): void {
  if (capWarned) return;
  capWarned = true;
  console.warn(
    `gdluxx: scroll accumulator reached ${MAX_ACCUMULATED_URLS} URLs, no longer collecting.`,
  );
}

function warnUnsupportedOnce(): void {
  if (unsupportedWarned) return;
  unsupportedWarned = true;
  console.warn(
    'gdluxx: scroll accumulation does not support string-marker container/image sources; skipping.',
  );
}

function addUrl(url: string): boolean {
  if (urls.has(url)) return false;
  if (urls.size >= MAX_ACCUMULATED_URLS) {
    warnCapOnce();
    return false;
  }
  urls.add(url);
  return true;
}

function readImageUrl(el: Element, attr: string): string | null {
  const raw = el.getAttribute(attr);
  return raw ? resolveUrl(raw) : null;
}

function resolveContainer(config: TargetedExtractionConfig): Element | null {
  const { container } = config;
  if (container.via === 'body') return document.body;
  if (container.via === 'selector') {
    try {
      return document.querySelector(container.selector);
    } catch {
      return null;
    }
  }
  return null; // 'string' no DOM node to observe, filtered out before this is called
}

function seed(): void {
  if (!containerEl || !currentConfig || currentConfig.images.via !== 'selector') return;
  const { selector, attr } = currentConfig.images;
  try {
    for (const el of containerEl.querySelectorAll(selector)) {
      const url = readImageUrl(el, attr);
      if (url) addUrl(url);
    }
  } catch {
    // invalid selector nothing to seed
  }
}

function disconnectObserverOnly(): void {
  observer?.disconnect();
  observer = null;
}

function clearPendingDebounce(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingRecords = [];
  firstQueuedAt = null;
}

function startObserving(): void {
  if (!containerEl) return;
  observer = new MutationObserver((records) => {
    pendingRecords.push(...records);
    scheduleFlush();
  });
  observer.observe(containerEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ATTRIBUTE_FILTER,
  });
}

function scheduleFlush(): void {
  const now = Date.now();
  if (firstQueuedAt === null) firstQueuedAt = now;
  if (debounceTimer !== null) clearTimeout(debounceTimer);

  const elapsed = now - firstQueuedAt;
  const wait = Math.min(DEBOUNCE_MS, Math.max(0, MAX_WAIT_MS - elapsed));
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    firstQueuedAt = null;
    requestAnimationFrame(flush);
  }, wait);
}

function checkContainerHealth(): void {
  if (!containerEl || containerEl.isConnected) return;
  disconnectObserverOnly();
  containerEl = null;
  engageRecovery();
  notify();
}

function engageRecovery(): void {
  if (fallbackObserver || !currentConfig) return;
  fallbackObserver = new MutationObserver(() => scheduleRecoveryCheck());
  fallbackObserver.observe(document.body, { childList: true, subtree: true });
}

function disengageRecovery(): void {
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  fallbackObserver?.disconnect();
  fallbackObserver = null;
}

function scheduleRecoveryCheck(): void {
  if (fallbackTimer !== null) return;
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
    attemptRecovery();
  }, DEBOUNCE_MS);
}

function attemptRecovery(): void {
  if (!currentConfig) {
    disengageRecovery();
    return;
  }
  const resolved = resolveContainer(currentConfig);
  if (!resolved) return; // keep watching document.body

  disengageRecovery();
  containerEl = resolved;
  seed();
  startObserving();
  notify();
}

function flush(): void {
  const records = pendingRecords;
  pendingRecords = [];
  if (!currentConfig) return;

  checkContainerHealth();
  if (!containerEl) return; // lost - fallback observer is now watching for recovery

  if (currentConfig.images.via !== 'selector') return;
  const { selector, attr } = currentConfig.images;

  let grew = false;
  for (const record of records) {
    if (record.type === 'childList') {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        try {
          if (node.matches(selector)) {
            const url = readImageUrl(node, attr);
            if (url && addUrl(url)) grew = true;
          }
          for (const el of node.querySelectorAll(selector)) {
            const url = readImageUrl(el, attr);
            if (url && addUrl(url)) grew = true;
          }
        } catch {
          // invalid selector; nothing to collect from this node
        }
      }
    } else if (record.type === 'attributes') {
      const target = record.target;
      if (!(target instanceof Element)) continue;
      try {
        if (target.matches(selector)) {
          const url = readImageUrl(target, attr);
          if (url && addUrl(url)) grew = true;
        }
      } catch {
        // invalid selector
      }
    }
  }

  if (grew) notify();
}

export function configure(config: TargetedExtractionConfig | null): void {
  const nextJson = config ? JSON.stringify(config) : null;
  const containerLost = containerEl !== null && !containerEl.isConnected;
  if (nextJson === activeConfigJson && !containerLost) return;

  disconnectObserverOnly();
  disengageRecovery();
  clearPendingDebounce();
  urls = new Set();
  containerEl = null;
  currentConfig = null;
  activeConfigJson = nextJson;
  capWarned = false;
  unsupportedWarned = false;

  if (!config) {
    notify();
    return;
  }

  if (config.container.via === 'string' || config.images.via === 'string') {
    warnUnsupportedOnce();
    notify();
    return;
  }

  currentConfig = config;
  containerEl = resolveContainer(config);
  if (!containerEl) {
    notify();
    return;
  }

  seed();
  startObserving();
  notify();
}

export function snapshot(): string[] {
  checkContainerHealth();
  return [...urls];
}

export function count(): number {
  checkContainerHealth();
  return urls.size;
}

export function isActive(): boolean {
  checkContainerHealth();
  return containerEl !== null;
}

export function reset(): void {
  disconnectObserverOnly();
  disengageRecovery();
  clearPendingDebounce();
  urls = new Set();
  containerEl = null;
  currentConfig = null;
  activeConfigJson = null;
  capWarned = false;
  unsupportedWarned = false;
  notify();
}

export function onChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
