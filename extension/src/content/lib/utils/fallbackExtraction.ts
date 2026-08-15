/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ExtractionProfile } from '#src/content/types';
import { getServerCompat, isBlocked } from '#src/shared/serverCompat';
import {
  FALLBACK_URLS_CAPABILITY,
  fallbackSuppressedLogMessage,
  sanitizeFallbackUrls,
} from '#src/shared/extractionFallback';
import { discoverImages } from './gallerizedUtils';
import { requestCompatRefresh } from './gdluxxApi';
import { applySubRules } from './substitution';

export interface FallbackCollection {
  urls: string[];
  suppressedCount: number;
}

const EMPTY: FallbackCollection = { urls: [], suppressedCount: 0 };

export async function collectFallbackUrls(
  profile: ExtractionProfile,
  limit: number,
): Promise<FallbackCollection> {
  try {
    const discovered = discoverImages(profile.extraction);
    if (discovered.length === 0) return EMPTY;

    const rules = profile.rules;
    const mapped =
      rules.length > 0
        ? discovered.map((url) => {
            const result = applySubRules(url, rules);
            return result.modified ? result.modifiedUrl : url;
          })
        : discovered;

    const urls = sanitizeFallbackUrls(mapped, limit);
    if (urls.length === 0) return EMPTY;

    const compat = await getServerCompat();
    if (!isBlocked(compat, FALLBACK_URLS_CAPABILITY)) {
      return { urls, suppressedCount: 0 };
    }

    console.warn(fallbackSuppressedLogMessage(compat?.serverVersion ?? null, urls.length));

    await requestCompatRefresh('capability-blocked', FALLBACK_URLS_CAPABILITY);

    const rechecked = await getServerCompat();
    if (!isBlocked(rechecked, FALLBACK_URLS_CAPABILITY)) {
      console.warn(
        'gdluxx: server re-ping shows fallback URLs are supported after all — including them',
      );
      return { urls, suppressedCount: 0 };
    }

    return { urls: [], suppressedCount: urls.length };
  } catch {
    return EMPTY;
  }
}
