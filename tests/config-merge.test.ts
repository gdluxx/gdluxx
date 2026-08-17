/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { describe, expect, test, vi } from 'vitest';

const warnMock = vi.fn();

vi.mock('../src/lib/server/logger', () => ({
  serverLogger: {
    warn: (...args: unknown[]) => warnMock(...args),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { mergeIntoConfigText } from '../src/lib/server/config-merge';
import type { JsonValue } from '../src/lib/types/catalog';

describe('mergeIntoConfigText', () => {
  test('sets a new leaf under existing parents', () => {
    const text = JSON.stringify({ extractor: { ao3: { username: 'myuser' } } }, null, 2);

    const result = mergeIntoConfigText(text, ['extractor', 'ao3', 'password'], 'hunter2');

    expect(result.existed).toBe(false);
    expect(result.currentValue).toBeUndefined();
    expect(JSON.parse(result.text)).toEqual({
      extractor: { ao3: { username: 'myuser', password: 'hunter2' } },
    });
  });

  test('creates missing parents from an empty document', () => {
    const result = mergeIntoConfigText('{}', ['extractor', 'ao3', 'formats'], 'pdf');

    expect(result.existed).toBe(false);
    expect(result.currentValue).toBeUndefined();
    expect(JSON.parse(result.text)).toEqual({ extractor: { ao3: { formats: 'pdf' } } });
  });

  test('creates missing parents when only a shallower parent already exists', () => {
    const text = JSON.stringify({ extractor: { 'base-directory': '/downloads' } }, null, 2);

    const result = mergeIntoConfigText(text, ['extractor', 'ao3', 'formats'], 'pdf');

    expect(result.existed).toBe(false);
    expect(JSON.parse(result.text)).toEqual({
      extractor: { 'base-directory': '/downloads', ao3: { formats: 'pdf' } },
    });
  });

  test('overwrite: reports the prior value as currentValue and applies the new one', () => {
    const text = JSON.stringify({ extractor: { ao3: { formats: 'epub' } } }, null, 2);

    const result = mergeIntoConfigText(text, ['extractor', 'ao3', 'formats'], 'pdf');

    expect(result.existed).toBe(true);
    expect(result.currentValue).toBe('epub');
    expect(JSON.parse(result.text)).toEqual({ extractor: { ao3: { formats: 'pdf' } } });
  });

  test('existed is true (with null currentValue) when the prior value is JSON null', () => {
    const text = JSON.stringify({ extractor: { ao3: { formats: null } } }, null, 2);

    const result = mergeIntoConfigText(text, ['extractor', 'ao3', 'formats'], 'pdf');

    expect(result.existed).toBe(true);
    expect(result.currentValue).toBeNull();
  });

  test.each<[string, JsonValue]>([
    ['array', ['a', 'b', 'c']],
    ['object', { nested: true, n: 1 }],
    ['string', 'a-string'],
    ['number', 42],
    ['boolean true', true],
    ['boolean false', false],
    ['null', null],
  ])('merges a %s value correctly', (_label, value) => {
    const result = mergeIntoConfigText('{}', ['extractor', 'custom'], value);

    expect(JSON.parse(result.text)).toEqual({ extractor: { custom: value } });
  });

  describe('byte-identity outside the edited region', () => {
    const fixture = [
      '{',
      '  "extractor": {',
      '    "#": "first note",',
      '    "#": "second note   ",',
      '    "#":    "third note",',
      '    "base-directory":   "/data/downloads",',
      '',
      '    "twitter": {',
      '      "#": "site specific note",',
      '      "username": "myuser"',
      '    }',
      '  },',
      '  "downloader": {',
      '    "#": "unrelated section, must stay untouched",',
      '    "retries": 4',
      '  }',
      '}',
    ].join('\n');

    test('unedited regions -- including duplicate "#" keys and odd spacing -- survive verbatim', () => {
      const anchor = '"username": "myuser"';
      const anchorIndex = fixture.indexOf(anchor);
      expect(anchorIndex).toBeGreaterThan(-1);

      const prefix = fixture.slice(0, anchorIndex);
      const suffix = fixture.slice(anchorIndex + anchor.length);

      const result = mergeIntoConfigText(
        fixture,
        ['extractor', 'twitter', 'password'],
        'secret123',
      );

      expect(result.text.startsWith(prefix)).toBe(true);
      expect(result.text.endsWith(suffix)).toBe(true);

      const parsed = JSON.parse(result.text) as {
        extractor: { twitter: { username: string; password: string } };
        downloader: { retries: number };
      };
      expect(parsed.extractor.twitter.username).toBe('myuser');
      expect(parsed.extractor.twitter.password).toBe('secret123');
      expect(parsed.downloader.retries).toBe(4);

      expect(result.existed).toBe(false);
    });

    test('overwriting an existing value in the same fixture still preserves everything else', () => {
      const anchor = '"username": "myuser"';
      const replacement = '"username": "otheruser"';
      const anchorIndex = fixture.indexOf(anchor);
      const prefix = fixture.slice(0, anchorIndex);
      const suffix = fixture.slice(anchorIndex + anchor.length);

      const result = mergeIntoConfigText(
        fixture,
        ['extractor', 'twitter', 'username'],
        'otheruser',
      );

      expect(result.existed).toBe(true);
      expect(result.currentValue).toBe('myuser');
      expect(result.text.startsWith(prefix)).toBe(true);
      expect(result.text.endsWith(suffix)).toBe(true);
      expect(result.text.includes(replacement)).toBe(true);
    });
  });
});
