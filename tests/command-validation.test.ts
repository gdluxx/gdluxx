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
import { validateInput } from '../src/lib/server/validation/validation-utils';
import { API_LIMITS } from '../src/lib/server/constants';
import {
  buildDirectoryArgs,
  describeFallbackNormalization,
  externalApiSchema,
  normaliseFallbackUrls,
} from '../src/lib/server/validation/command-validation';

describe('normaliseFallbackUrls', () => {
  test('happy path: mixed http/https URLs, order preserved', () => {
    const input = ['https://a.test/1.jpg', 'http://b.test/2.png'];
    expect(normaliseFallbackUrls(input, 10)).toEqual(input);
  });

  test('everything fails the ^https?:// pattern', () => {
    expect(normaliseFallbackUrls(['ftp://a.test/1', 'not-a-url', ''], 10)).toEqual([]);
  });

  test('trims before pattern test', () => {
    expect(normaliseFallbackUrls([' https://a.test/1.jpg '], 10)).toEqual(['https://a.test/1.jpg']);
  });

  test('de-dupes identical entries via Set', () => {
    const input = ['https://a.test/1', 'https://a.test/1', 'https://a.test/1'];
    expect(normaliseFallbackUrls(input, 10)).toEqual(['https://a.test/1']);
  });

  test('truncates to cap, preserving first-seen order', () => {
    const input = ['https://a.test/1', 'https://a.test/2', 'https://a.test/3'];
    expect(normaliseFallbackUrls(input, 2)).toEqual(['https://a.test/1', 'https://a.test/2']);
  });

  test('mixed-type array: non-string items are dropped by the typeof filter', () => {
    const input = [1, null, undefined, {}, ['https://a.test/1']];
    expect(normaliseFallbackUrls(input, 10)).toEqual([]);
  });

  test('non-array input short-circuits to []', () => {
    expect(normaliseFallbackUrls('not-an-array', 10)).toEqual([]);
  });

  test.each([null, undefined])('non-array input (%p) short-circuits to []', (value) => {
    expect(normaliseFallbackUrls(value, 10)).toEqual([]);
  });

  test('cap of 0 clamps via Math.max(0, cap) -> slice(0, 0)', () => {
    expect(normaliseFallbackUrls(['https://a.test/1'], 0)).toEqual([]);
  });

  test('negative cap clamped via Math.max(0, cap)', () => {
    expect(normaliseFallbackUrls(['https://a.test/1'], -5)).toEqual([]);
  });
});

describe('externalApiSchema.fallbackUrls (via validateInput)', () => {
  test('undefined does not throw (field is required: false)', () => {
    expect(() => validateInput({ fallbackUrls: undefined }, externalApiSchema)).not.toThrow();
  });

  test('a valid array of strings does not throw', () => {
    expect(() =>
      validateInput({ fallbackUrls: ['https://a.test/1'] }, externalApiSchema),
    ).not.toThrow();
  });

  test('an empty array does not throw (no length floor)', () => {
    expect(() => validateInput({ fallbackUrls: [] }, externalApiSchema)).not.toThrow();
  });

  test('a bare string (not an array) throws', () => {
    expect(() => validateInput({ fallbackUrls: 'https://a.test/1' }, externalApiSchema)).toThrow();
  });

  test('array longer than API_LIMITS.MAX_BATCH_URLS throws', () => {
    const tooMany = Array.from(
      { length: API_LIMITS.MAX_BATCH_URLS + 1 },
      (_, i) => `https://a.test/${i}`,
    );
    expect(() => validateInput({ fallbackUrls: tooMany }, externalApiSchema)).toThrow();
  });

  test('array at exactly API_LIMITS.MAX_BATCH_URLS does not throw (boundary)', () => {
    const atCap = Array.from(
      { length: API_LIMITS.MAX_BATCH_URLS },
      (_, i) => `https://a.test/${i}`,
    );
    expect(() => validateInput({ fallbackUrls: atCap }, externalApiSchema)).not.toThrow();
  });

  test('entries that are not URL-shaped still pass schema validation (filtering happens later, in normaliseFallbackUrls)', () => {
    expect(() =>
      validateInput({ fallbackUrls: ['not-a-url', 12345, null] }, externalApiSchema),
    ).not.toThrow();
  });
});

describe('buildDirectoryArgs', () => {
  test('no siteDir, no customDir -> []', () => {
    expect(buildDirectoryArgs(undefined, undefined)).toEqual([]);
  });

  test('site only', () => {
    expect(buildDirectoryArgs('example.com', undefined)).toEqual([
      '-o',
      'directory=["example.com"]',
    ]);
  });

  test('custom only, spaces preserved', () => {
    expect(buildDirectoryArgs(undefined, 'my folder')).toEqual(['-o', 'directory=["my folder"]']);
  });

  test('site then custom, comma-joined', () => {
    expect(buildDirectoryArgs('example.com', 'my folder')).toEqual([
      '-o',
      'directory=["example.com","my folder"]',
    ]);
  });

  test('embedded double-quote in siteDir is escaped', () => {
    expect(buildDirectoryArgs('ex"ample.com', undefined)).toEqual([
      '-o',
      'directory=["ex\\"ample.com"]',
    ]);
  });

  test('empty strings are falsy: both short-circuit to []', () => {
    expect(buildDirectoryArgs('', '')).toEqual([]);
  });

  test('multiple embedded quotes in customDir are all escaped', () => {
    expect(buildDirectoryArgs(undefined, 'a"b"c')).toEqual(['-o', 'directory=["a\\"b\\"c"]']);
  });
});

describe('describeFallbackNormalization', () => {
  test('field omitted entirely (undefined rawValue)', () => {
    const result = describeFallbackNormalization(undefined, 0);
    expect(result.lostEntries).toBe(false);
    expect(result.allLost).toBe(false);
    expect(result.description).toContain('did not send');
  });

  test('empty fallbackUrls array (extraction found nothing)', () => {
    const result = describeFallbackNormalization([], 0);
    expect(result.lostEntries).toBe(false);
    expect(result.allLost).toBe(false);
    expect(result.description).toContain('empty');
  });

  test('every entry filtered out by normalization', () => {
    const result = describeFallbackNormalization(['not-a-url', 123], 0);
    expect(result.lostEntries).toBe(true);
    expect(result.allLost).toBe(true);
  });

  test('partial loss during normalization', () => {
    const result = describeFallbackNormalization(['https://a.test/1', 'not-a-url'], 1);
    expect(result.lostEntries).toBe(true);
    expect(result.allLost).toBe(false);
  });

  test('nothing lost — all entries survived normalization', () => {
    const result = describeFallbackNormalization(['https://a.test/1', 'https://a.test/2'], 2);
    expect(result.lostEntries).toBe(false);
    expect(result.allLost).toBe(false);
    expect(result.description).toContain('provided');
  });
});
