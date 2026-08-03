/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { DirectorySource } from '#src/content/types';
import { sanitizeDirectoryName } from './validation';

export interface DirectoryResolution {
  value: string | null;
  reason: string | null;
}

// Session-scoped list of page URLs the user dismissed an auto filled folder on
// Lives here rather than in persistence.ts because that module is aliased to
// the dev mocks
const DIR_AUTOFILL_OPTOUT_KEY = 'gdluxx_dir_autofill_optouts';

export function resolveDirectoryFromSource(source: DirectorySource): DirectoryResolution {
  const selector = source.selector.trim();
  if (!selector) return { value: null, reason: 'No directory selector configured' };
  if (typeof document === 'undefined') {
    return { value: null, reason: 'Page is not available' };
  }

  let element: Element | null;
  try {
    element = document.querySelector(selector);
  } catch {
    return { value: null, reason: 'Invalid directory selector' };
  }

  if (!element) {
    return { value: null, reason: 'Directory selector matched nothing on this page' };
  }

  const attr = source.attr?.trim();
  const raw = attr ? element.getAttribute(attr) : element.textContent;
  if (!raw || !raw.trim()) {
    return {
      value: null,
      reason: attr
        ? `Attribute "${attr}" is empty on the matched element`
        : 'Matched element has no text',
    };
  }

  let candidate = raw;
  const transform = source.transform;
  if (transform && transform.pattern.trim()) {
    try {
      const regex = new RegExp(transform.pattern, transform.flags ?? '');
      candidate = candidate.replace(regex, transform.replacement ?? '');
    } catch {
      return { value: null, reason: 'Invalid directory transform pattern' };
    }
  }

  const value = sanitizeDirectoryName(candidate);
  if (!value) {
    return { value: null, reason: 'Extracted folder name has no valid characters' };
  }

  return { value, reason: null };
}

export function readDirAutoFillOptOuts(): ReadonlySet<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(DIR_AUTOFILL_OPTOUT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value) => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export function persistDirAutoFillOptOut(href: string): void {
  if (typeof window === 'undefined' || !href) return;
  try {
    const next = new Set(readDirAutoFillOptOuts());
    next.add(href);
    window.sessionStorage.setItem(DIR_AUTOFILL_OPTOUT_KEY, JSON.stringify(Array.from(next)));
  } catch {
    // Silently fail to avoid breaking overlay flow
  }
}
