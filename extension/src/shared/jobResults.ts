/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Shared between the content-script send flow, gdluxxApi.ts, and the
// background job tracker, jobTracker.ts, so the expansion logic
// lives in exactly one place.

import type { BatchUrlResult } from '#src/background/apiProxy';

// The server collapses 2+ direct media URLs in one request into a single
// results entry keyed by this sentinel instead of one entry per URL - see
// src/routes/api/extension/external/+server.ts
export const DIRECTLINK_BATCH_SENTINEL = 'directlink batch';

export function expandJobResults(
  inputUrls: string[],
  resultEntries: BatchUrlResult[],
): BatchUrlResult[] {
  const sentinel = resultEntries.find((entry) => entry.url === DIRECTLINK_BATCH_SENTINEL);

  const namedByUrl = new Map<string, BatchUrlResult[]>();
  for (const entry of resultEntries) {
    if (entry.url === DIRECTLINK_BATCH_SENTINEL) continue;
    const key = entry.url.trim();
    const existing = namedByUrl.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      namedByUrl.set(key, [entry]);
    }
  }

  return inputUrls.map((url) => {
    const named = namedByUrl.get(url.trim());
    if (named?.length) {
      return named.shift() as BatchUrlResult;
    }
    if (sentinel) {
      return {
        url,
        success: sentinel.success,
        jobId: sentinel.jobId,
        message: sentinel.message,
        error: sentinel.error,
      };
    }
    return { url, success: false, error: 'No result returned by server' };
  });
}
