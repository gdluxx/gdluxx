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
import { describeFallbackNormalization } from '../src/lib/server/validation/command-validation';

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
