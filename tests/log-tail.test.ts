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
import { LOG_FILE_PATTERN } from '../src/lib/logging';

// Only the pure helpers are under test here. The module also pulls in the
// Winston logger, whose constructor opens the SQLite database, so it is stubbed
// out the same way tests/config-utils.test.ts does.
vi.mock('../src/lib/server/logger', () => ({
  serverLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  sanitizeMessage: (message: string) => message,
}));

const { extractTailLines, selectNewestLogFile } = await import('../src/lib/server/logTail');

describe('LOG_FILE_PATTERN', () => {
  // The log directory is routinely shared with the SQLite database, cookies,
  // and gallery-dl's own output, so this allowlist is the only thing standing
  // between the tail and an unrelated file
  test.each([
    'gdluxx-2026-07-29.log',
    'gdluxx-2026-01-01.log',
    'gdluxx-2026-07-29.log.1',
    'gdluxx-2026-07-29.log.12',
  ])('accepts %s', (name) => {
    expect(LOG_FILE_PATTERN.test(name)).toBe(true);
  });

  test.each([
    '.audit.json',
    '.f00ba7-audit.json',
    'gdluxx.db',
    'gdluxx.db-wal',
    'gallery-dl.log',
    'gdluxx.log',
    'gdluxx-2026-07-29.log.bak',
    'gdluxx-2026-7-9.log',
    'gdluxx-2026-07-29.txt',
    'x-gdluxx-2026-07-29.log',
    'gdluxx-2026-07-29.log.1.gz',
    'cookies.txt',
    'config.json',
  ])('rejects %s', (name) => {
    expect(LOG_FILE_PATTERN.test(name)).toBe(false);
  });
});

describe('selectNewestLogFile', () => {
  test('returns null for an empty list', () => {
    expect(selectNewestLogFile([])).toBeNull();
  });

  test('returns the only entry', () => {
    expect(selectNewestLogFile([{ name: 'gdluxx-2026-07-29.log', mtimeMs: 5 }])).toBe(
      'gdluxx-2026-07-29.log',
    );
  });

  test('picks the highest mtime regardless of list order', () => {
    const entries = [
      { name: 'gdluxx-2026-07-27.log', mtimeMs: 100 },
      { name: 'gdluxx-2026-07-29.log', mtimeMs: 300 },
      { name: 'gdluxx-2026-07-28.log', mtimeMs: 200 },
    ];
    expect(selectNewestLogFile(entries)).toBe('gdluxx-2026-07-29.log');
    expect(selectNewestLogFile([...entries].reverse())).toBe('gdluxx-2026-07-29.log');
  });

  test('breaks mtime ties on the descending filename', () => {
    const entries = [
      { name: 'gdluxx-2026-07-29.log', mtimeMs: 42 },
      { name: 'gdluxx-2026-07-29.log.1', mtimeMs: 42 },
    ];
    expect(selectNewestLogFile(entries)).toBe('gdluxx-2026-07-29.log.1');
    expect(selectNewestLogFile([...entries].reverse())).toBe('gdluxx-2026-07-29.log.1');
  });

  test('a newer mtime wins over a higher name', () => {
    const entries = [
      { name: 'gdluxx-2026-07-29.log.9', mtimeMs: 10 },
      { name: 'gdluxx-2026-07-29.log', mtimeMs: 20 },
    ];
    expect(selectNewestLogFile(entries)).toBe('gdluxx-2026-07-29.log');
  });
});

describe('extractTailLines', () => {
  test('returns nothing for an empty read', () => {
    expect(extractTailLines('', 200, false)).toEqual([]);
    expect(extractTailLines('', 200, true)).toEqual([]);
  });

  test('drops the single trailing empty element from a final newline', () => {
    expect(extractTailLines('a\nb\n', 200, false)).toEqual(['a', 'b']);
  });

  test('keeps the last line when the file has no trailing newline', () => {
    expect(extractTailLines('a\nb', 200, false)).toEqual(['a', 'b']);
  });

  test('handles CRLF line endings', () => {
    expect(extractTailLines('a\r\nb\r\n', 200, false)).toEqual(['a', 'b']);
    expect(extractTailLines('a\r\nb', 200, false)).toEqual(['a', 'b']);
  });

  test('preserves blank lines inside the output', () => {
    expect(extractTailLines('a\n\nb\n', 200, false)).toEqual(['a', '', 'b']);
  });

  test('returns fewer lines than requested when that is all there is', () => {
    expect(extractTailLines('a\nb\n', 200, false)).toHaveLength(2);
  });

  test('returns only the last maxLines when there are more', () => {
    const text = Array.from({ length: 10 }, (_, i) => `line-${i}`).join('\n');
    expect(extractTailLines(text, 3, false)).toEqual(['line-7', 'line-8', 'line-9']);
  });

  test('drops the partial first line when the read started mid-file', () => {
    expect(extractTailLines('aaa\nbbb\nccc\n', 200, true)).toEqual(['bbb', 'ccc']);
  });

  test('keeps the first line when the read started at byte zero', () => {
    expect(extractTailLines('aaa\nbbb\nccc\n', 200, false)).toEqual(['aaa', 'bbb', 'ccc']);
  });

  test('a single partial line yields nothing', () => {
    expect(extractTailLines('partial-only', 200, true)).toEqual([]);
  });

  test('maxLines of zero or less yields nothing', () => {
    expect(extractTailLines('a\nb\n', 0, false)).toEqual([]);
    expect(extractTailLines('a\nb\n', -5, false)).toEqual([]);
  });

  test('offset drop happens before the tail slice', () => {
    const text = 'partial\none\ntwo\nthree\n';
    expect(extractTailLines(text, 3, true)).toEqual(['one', 'two', 'three']);
  });
});
