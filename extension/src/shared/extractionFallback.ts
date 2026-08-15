/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Pure module - no DOM, no `browser.*`, no storage. See
// `src/content/lib/utils/fallbackExtraction.ts` for the DOM/storage half; the
// split exists because the extension workspace has no jsdom, so only this
// half is unit-testable.

export const FALLBACK_URLS_CAPABILITY = 'external.fallbackUrls';

export const MAX_FALLBACK_URLS = 200;

export function fallbackSuppressedLogMessage(serverVersion: string | null, count: number): string {
  return (
    `gdluxx: fallback URLs suppressed: server capability ${FALLBACK_URLS_CAPABILITY} ` +
    `absent (server ${serverVersion ?? 'version unknown'}) — ` +
    `${count} extracted URL${count === 1 ? '' : 's'} dropped from this send`
  );
}

export function fallbackSuppressedNoticeText(serverVersion: string | null, count: number): string {
  return (
    ` (direct-link fallback skipped: this gdluxx server (${serverVersion ?? 'version unknown'})` +
    ` doesn't support it — ${count} extracted URL${count === 1 ? '' : 's'} not sent;` +
    ` update gdluxx to enable it)`
  );
}

export function sanitizeFallbackUrls(raw: readonly string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    if (out.length >= limit) break;
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    let protocol: string;
    try {
      protocol = new URL(trimmed).protocol;
    } catch {
      continue;
    }
    if (protocol !== 'http:' && protocol !== 'https:') continue;

    seen.add(trimmed);
    out.push(trimmed);
  }

  return out;
}
