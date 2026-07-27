/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const ALL_URLS = '<all_urls>';

const SUPPORTED_PERMISSION_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:']);

/**
 * Build a WebExtension match pattern for a URL's origin.
 *
 * Match patterns require a path component, so a bare origin such as
 * `https://example.com` is invalid and makes `permissions.contains()` /
 * `permissions.request()` throw rather than return false. Always route origins
 * through this helper before handing them to the permissions API.
 *
 * Returns null for pages that cannot hold host permissions (about:, file:,
 * data:, sandboxed frames with an opaque origin).
 */
export function formatOriginPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!SUPPORTED_PERMISSION_PROTOCOLS.has(parsed.protocol) || parsed.origin === 'null') {
      return null;
    }
    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

/**
 * Recover the origin root URL from a match pattern produced by
 * `formatOriginPattern`, `https://example.com/*` becomes
 * `https://example.com/`
 *
 * Derived rather than passed alongside the pattern on purpose: carrying two
 * origin-shaped fields is what let a bare origin reach the permissions API in
 * the first place.
 */
export function originUrlFromPattern(pattern: string): string | null {
  if (!pattern.endsWith('/*')) {
    return null;
  }

  const candidate = pattern.slice(0, -1);
  try {
    const parsed = new URL(candidate);
    if (!SUPPORTED_PERMISSION_PROTOCOLS.has(parsed.protocol) || parsed.origin === 'null') {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}
