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
import { FALLBACK_URLS_CAPABILITY, sanitizeFallbackUrls } from '#src/shared/extractionFallback';
import { discoverImages } from './gallerizedUtils';
import { applySubRules } from './substitution';

export async function collectFallbackUrls(
  profile: ExtractionProfile,
  limit: number,
): Promise<string[]> {
  try {
    const compat = await getServerCompat();
    if (isBlocked(compat, FALLBACK_URLS_CAPABILITY)) return [];

    const discovered = discoverImages(profile.extraction);
    if (discovered.length === 0) return [];

    const rules = profile.rules;
    const mapped =
      rules.length > 0
        ? discovered.map((url) => {
            const result = applySubRules(url, rules);
            return result.modified ? result.modifiedUrl : url;
          })
        : discovered;

    return sanitizeFallbackUrls(mapped, limit);
  } catch {
    return [];
  }
}
