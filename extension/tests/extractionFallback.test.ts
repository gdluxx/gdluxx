/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { describe, expect, test } from 'vitest';
import {
  FALLBACK_URLS_CAPABILITY,
  MAX_FALLBACK_URLS,
  sanitizeFallbackUrls,
} from '#src/shared/extractionFallback';

describe('sanitizeFallbackUrls', () => {
  test('keeps http and https URLs', () => {
    const raw = ['http://example.com/a.jpg', 'https://example.com/b.jpg'];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(raw);
  });

  test('drops data: URLs', () => {
    const raw = ['data:image/png;base64,AAAA', 'https://example.com/b.jpg'];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(['https://example.com/b.jpg']);
  });

  test('drops blob: URLs', () => {
    const raw = ['blob:https://example.com/uuid', 'https://example.com/b.jpg'];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(['https://example.com/b.jpg']);
  });

  test('drops javascript: URLs', () => {
    const raw = ['javascript:alert(1)', 'https://example.com/b.jpg'];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(['https://example.com/b.jpg']);
  });

  test('drops empty and whitespace-only entries', () => {
    const raw = ['', '   ', 'https://example.com/b.jpg'];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(['https://example.com/b.jpg']);
  });

  test('drops unparseable strings without throwing', () => {
    const raw = ['not a url', 'https://example.com/b.jpg'];
    expect(() => sanitizeFallbackUrls(raw, 10)).not.toThrow();
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(['https://example.com/b.jpg']);
  });

  test('trims surrounding whitespace before validating', () => {
    const raw = ['  https://example.com/a.jpg  '];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual(['https://example.com/a.jpg']);
  });

  test('de-dupes while preserving first-seen order', () => {
    const raw = [
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/a.jpg',
    ];
    expect(sanitizeFallbackUrls(raw, 10)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
  });

  test('caps output at the given limit', () => {
    const raw = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = sanitizeFallbackUrls(raw, 3);
    expect(result).toHaveLength(3);
    expect(result).toEqual(raw.slice(0, 3));
  });

  test('limit counts accepted URLs, not raw entries', () => {
    const raw = [
      'data:image/png;base64,AAAA',
      'https://example.com/a.jpg',
      'javascript:alert(1)',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg',
    ];
    expect(sanitizeFallbackUrls(raw, 2)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
  });

  test('empty input returns an empty array', () => {
    expect(sanitizeFallbackUrls([], 10)).toEqual([]);
  });

  test('a limit of 0 returns an empty array', () => {
    expect(sanitizeFallbackUrls(['https://example.com/a.jpg'], 0)).toEqual([]);
  });
});

describe('constants', () => {
  test('FALLBACK_URLS_CAPABILITY is the flag string the server registers', () => {
    expect(FALLBACK_URLS_CAPABILITY).toBe('external.fallbackUrls');
  });

  test('MAX_FALLBACK_URLS is a positive integer', () => {
    expect(Number.isInteger(MAX_FALLBACK_URLS)).toBe(true);
    expect(MAX_FALLBACK_URLS).toBeGreaterThan(0);
  });
});
