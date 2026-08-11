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
import { createSubRule, summarisePreview, type SubRule } from '#utils/substitution';

function rule(overrides: Partial<SubRule> = {}): SubRule {
  return { ...createSubRule('foo', 'bar', 'g', 0), ...overrides };
}

describe('summarisePreview', () => {
  test('empty urls and empty rules return an empty summary', () => {
    expect(summarisePreview([], [])).toEqual({ items: [], changedCount: 0, scanned: 0 });
  });

  test('the guard branch reports scanned 0 even when urls are present', () => {
    const urls = ['https://example.com/foo'];

    expect(summarisePreview(urls, [])).toEqual({ items: [], changedCount: 0, scanned: 0 });
    expect(summarisePreview([], [rule()])).toEqual({ items: [], changedCount: 0, scanned: 0 });
  });

  test('changedCount counts every changed URL, not just the first `limit`', () => {
    const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/foo-${i}`);
    const summary = summarisePreview(urls, [rule()], 5);

    expect(summary.items).toHaveLength(5);
    expect(summary.changedCount).toBe(20);
  });

  test('unchanged URLs are excluded from both items and changedCount', () => {
    const urls = ['https://example.com/foo', 'https://example.com/nomatch'];
    const summary = summarisePreview(urls, [rule()]);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].original).toBe('https://example.com/foo');
    expect(summary.changedCount).toBe(1);
  });

  test('scanned equals urls.length when rules are present', () => {
    const urls = ['https://example.com/foo', 'https://example.com/nomatch', 'https://x/y'];
    const summary = summarisePreview(urls, [rule()]);

    expect(summary.scanned).toBe(urls.length);
  });

  test('disabled rules contribute nothing', () => {
    const urls = ['https://example.com/foo'];
    const summary = summarisePreview(urls, [rule({ enabled: false })]);

    expect(summary.items).toEqual([]);
    expect(summary.changedCount).toBe(0);
  });

  test('an empty-pattern rule is skipped, not thrown on', () => {
    const urls = ['https://example.com/foo'];

    expect(() => summarisePreview(urls, [rule({ pattern: '' })])).not.toThrow();
    const summary = summarisePreview(urls, [rule({ pattern: '' })]);
    expect(summary.items).toEqual([]);
    expect(summary.changedCount).toBe(0);
  });

  test('duplicate input URLs produce duplicate items', () => {
    const urls = ['https://example.com/foo', 'https://example.com/foo'];
    const summary = summarisePreview(urls, [rule()]);

    expect(summary.items).toHaveLength(2);
    expect(summary.changedCount).toBe(2);
    expect(summary.items[0].original).toBe(summary.items[1].original);
  });
});
