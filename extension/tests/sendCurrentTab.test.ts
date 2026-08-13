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
import { pickCustomDirectory } from '#utils/sendCurrentTab';
import { isValidSiteDirectory } from '#utils/validation';

describe('pickCustomDirectory', () => {
  test('manual wins over resolved when both are valid', () => {
    expect(pickCustomDirectory({ enabled: true, value: 'manual-dir' }, 'resolved-dir', false)).toBe(
      'manual-dir',
    );
  });

  test('manual empty falls through to resolved', () => {
    expect(pickCustomDirectory({ enabled: true, value: '' }, 'resolved-dir', false)).toBe(
      'resolved-dir',
    );
  });

  test('manual whitespace-only falls through to resolved', () => {
    expect(pickCustomDirectory({ enabled: true, value: '   ' }, 'resolved-dir', false)).toBe(
      'resolved-dir',
    );
  });

  test('manual disabled uses resolved', () => {
    expect(
      pickCustomDirectory({ enabled: false, value: 'manual-dir' }, 'resolved-dir', false),
    ).toBe('resolved-dir');
  });

  test('manual with illegal characters falls through to resolved', () => {
    expect(pickCustomDirectory({ enabled: true, value: 'a/b' }, 'resolved-dir', false)).toBe(
      'resolved-dir',
    );
    expect(pickCustomDirectory({ enabled: true, value: 'a:b' }, 'resolved-dir', false)).toBe(
      'resolved-dir',
    );
  });

  test('optedOut suppresses resolved but not manual', () => {
    expect(pickCustomDirectory({ enabled: true, value: 'manual-dir' }, 'resolved-dir', true)).toBe(
      'manual-dir',
    );
    expect(
      pickCustomDirectory({ enabled: false, value: '' }, 'resolved-dir', true),
    ).toBeUndefined();
  });

  test('resolved null returns undefined', () => {
    expect(pickCustomDirectory({ enabled: false, value: '' }, null, false)).toBeUndefined();
  });

  test('resolved empty string returns undefined', () => {
    expect(pickCustomDirectory({ enabled: false, value: '' }, '', false)).toBeUndefined();
  });

  test('resolved whitespace-only returns undefined', () => {
    expect(pickCustomDirectory({ enabled: false, value: '' }, '   ', false)).toBeUndefined();
  });

  test('resolved with illegal characters returns undefined', () => {
    expect(pickCustomDirectory({ enabled: false, value: '' }, 'a/b', false)).toBeUndefined();
  });

  test('256-char manual value returns undefined (falls through) when resolved is also invalid', () => {
    const long = 'a'.repeat(256);
    expect(pickCustomDirectory({ enabled: true, value: long }, null, false)).toBeUndefined();
  });

  test('256-char resolved value returns undefined', () => {
    const long = 'a'.repeat(256);
    expect(pickCustomDirectory({ enabled: false, value: '' }, long, false)).toBeUndefined();
  });

  test('255-char manual value (at the boundary) is accepted', () => {
    const atLimit = 'a'.repeat(255);
    expect(pickCustomDirectory({ enabled: true, value: atLimit }, null, false)).toBe(atLimit);
  });
});

describe('isValidSiteDirectory', () => {
  test.each([
    'example.com',
    'sub.example.co.uk',
    'localhost',
    '127.0.0.1',
    'xn--e1afmkfd.xn--p1ai',
    'a',
  ])('accepts %s', (hostname) => {
    expect(isValidSiteDirectory(hostname)).toBe(true);
  });

  test.each(['', '[::1]', 'my_site.local', 'example.com.', '-example.com', 'example.com-'])(
    'rejects %s',
    (hostname) => {
      expect(isValidSiteDirectory(hostname)).toBe(false);
    },
  );

  test('rejects a 254-char hostname (over the 253 limit)', () => {
    // Build a syntactically valid but over length hostname
    const label = 'a'.repeat(63);
    const hostname = `${label}.${label}.${label}.${'a'.repeat(254 - 3 * 64)}`;
    expect(hostname.length).toBe(254);
    expect(isValidSiteDirectory(hostname)).toBe(false);
  });
});
