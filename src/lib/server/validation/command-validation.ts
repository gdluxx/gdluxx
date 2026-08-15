/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ValidationSchema } from './validation-utils';
import { validateConfigArray } from './validation-utils';
import { API_LIMITS } from '../constants';

export const commandStreamSchema: ValidationSchema = {
  url: {
    required: true,
    minLength: 1,
    pattern: /^https?:\/\/.+/,
  },
};

const URL_PATTERN = /^https?:\/\/.+/;

export const externalApiSchema: ValidationSchema = {
  // single URL
  urlToProcess: {
    required: false,
    minLength: 1,
    pattern: URL_PATTERN,
  },
  // array of URLs
  urls: {
    required: false,
    custom: (value: unknown) =>
      Array.isArray(value) &&
      validateConfigArray(
        value,
        API_LIMITS.MAX_BATCH_URLS,
        (u: unknown) => typeof u === 'string' && URL_PATTERN.test(u.trim()),
      ),
  },
  // optional custom directory
  customDirectory: {
    required: false,
    minLength: 1,
    maxLength: 255,
    pattern: /^[a-zA-Z0-9_\-. ]+$/,
  },
  // optional site directory (hostname of the page)
  siteDirectory: {
    required: false,
    minLength: 1,
    maxLength: 253,
    pattern: /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
  },
  // optional advisory list of DOM extracted directlink URLs, used as a
  // fallback batch when gallery-dl has no extractor for the primary URL
  fallbackUrls: {
    required: false,
    custom: (value: unknown) =>
      Array.isArray(value) && validateConfigArray(value, API_LIMITS.MAX_BATCH_URLS),
  },
};

export function buildDirectoryArgs(siteDir?: string, customDir?: string): string[] {
  const parts: string[] = [];
  if (siteDir) {
    parts.push(`"${siteDir.replace(/"/g, '\\"')}"`);
  }
  if (customDir) {
    parts.push(`"${customDir.replace(/"/g, '\\"')}"`);
  }
  if (parts.length === 0) {
    return [];
  }
  return ['-o', `directory=[${parts.join(',')}]`];
}

export function normaliseFallbackUrls(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const trimmed = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => URL_PATTERN.test(item));

  const deduped = [...new Set(trimmed)];

  return deduped.slice(0, Math.max(0, cap));
}

export interface FallbackNormalizationResult {
  description: string;
  lostEntries: boolean;
  allLost: boolean;
}

export function describeFallbackNormalization(
  rawValue: unknown,
  normalizedCount: number,
): FallbackNormalizationResult {
  if (!Array.isArray(rawValue)) {
    return {
      description: 'extension did not send a fallbackUrls field',
      lostEntries: false,
      allLost: false,
    };
  }
  if (rawValue.length === 0) {
    return {
      description: 'extension sent an empty fallbackUrls array (no direct-link candidates found)',
      lostEntries: false,
      allLost: false,
    };
  }
  if (normalizedCount === 0) {
    return {
      description: `extension sent ${rawValue.length} fallbackUrls entr${
        rawValue.length === 1 ? 'y' : 'ies'
      }, all were removed by normalization (invalid URL shape or non-string values)`,
      lostEntries: true,
      allLost: true,
    };
  }
  if (normalizedCount < rawValue.length) {
    return {
      description: `extension sent ${rawValue.length} fallbackUrls, only ${normalizedCount} survived normalization (invalid entries, duplicates, or the per-request cap)`,
      lostEntries: true,
      allLost: false,
    };
  }
  return {
    description: `${normalizedCount} fallbackUrls provided`,
    lostEntries: false,
    allLost: false,
  };
}

export const jobIdSchema: ValidationSchema = {
  jobId: { required: true, minLength: 1 },
};
