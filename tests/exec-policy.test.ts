/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// option-validation.ts (imported below for the T-1.7 drift guard) pulls in
// the server logger, unavailable outside SvelteKit.
vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
import {
  findCommandExecutionViolations,
  findConfigViolations,
  findPathViolations,
  isProhibitedOptionId,
  assertOptionIdsAllowed,
  ProhibitedOptionError,
  PROHIBITED_OPTION_IDS,
} from '../src/lib/server/validation/exec-policy';
import { validOptions } from '../src/lib/server/validation/option-validation';

const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;
const ORIGINAL_DOWNLOAD_PATH = process.env.DOWNLOAD_PATH;
const ORIGINAL_EXTRA_ROOTS = process.env.GDLUXX_CONFIG_PATH_ROOTS;

function restoreEnv(): void {
  if (ORIGINAL_FILE_STORAGE_PATH === undefined) {
    delete process.env.FILE_STORAGE_PATH;
  } else {
    process.env.FILE_STORAGE_PATH = ORIGINAL_FILE_STORAGE_PATH;
  }
  if (ORIGINAL_DOWNLOAD_PATH === undefined) {
    delete process.env.DOWNLOAD_PATH;
  } else {
    process.env.DOWNLOAD_PATH = ORIGINAL_DOWNLOAD_PATH;
  }
  if (ORIGINAL_EXTRA_ROOTS === undefined) {
    delete process.env.GDLUXX_CONFIG_PATH_ROOTS;
  } else {
    process.env.GDLUXX_CONFIG_PATH_ROOTS = ORIGINAL_EXTRA_ROOTS;
  }
}

describe('exec-policy: R1-R3 command-execution detection', () => {
  test('T-1.1: an exec postprocessor with both a name and a command key triggers both rules', () => {
    const config = {
      extractor: {
        postprocessors: [{ name: 'exec', command: ['gdluxx-rem006-sentinel'] }],
      },
    };
    const violations = findConfigViolations(config);
    expect(violations).toContainEqual({
      rule: 'command-bearing-key',
      pointer: 'extractor.postprocessors[0].command',
    });
    expect(violations).toContainEqual({
      rule: 'prohibited-postprocessor',
      pointer: 'extractor.postprocessors[0]',
    });
  });

  test('T-1.2: top-level dict-form postprocessor with name=exec', () => {
    const config = { postprocessor: { alias: { name: 'exec' } } };
    const violations = findCommandExecutionViolations(config);
    expect(violations).toContainEqual({
      rule: 'prohibited-postprocessor',
      pointer: 'postprocessor.alias',
    });
  });

  test('T-1.2 (python): name=python is prohibited the same as name=exec [review R-1]', () => {
    const config = {
      postprocessor: { alias: { name: 'python', function: 'gdluxx_rem006_sentinel:run' } },
    };
    const violations = findCommandExecutionViolations(config);
    expect(violations).toContainEqual({
      rule: 'prohibited-postprocessor',
      pointer: 'postprocessor.alias',
    });
  });

  test('T-1.3: per-category nested postprocessors array', () => {
    const config = {
      extractor: { twitter: { timeline: { postprocessors: [{ name: 'exec' }] } } },
    };
    const violations = findCommandExecutionViolations(config);
    expect(violations).toContainEqual({
      rule: 'prohibited-postprocessor',
      pointer: 'extractor.twitter.timeline.postprocessors[0]',
    });
  });

  test('T-1.4: string reference form (array element and bare string)', () => {
    const arrayForm = findCommandExecutionViolations({ extractor: { postprocessors: ['exec'] } });
    expect(arrayForm).toContainEqual({
      rule: 'prohibited-postprocessor',
      pointer: 'extractor.postprocessors[0]',
    });

    const stringForm = findCommandExecutionViolations({
      extractor: { postprocessors: 'exec' },
    });
    expect(stringForm).toContainEqual({
      rule: 'prohibited-postprocessor',
      pointer: 'extractor.postprocessors',
    });
  });

  test('T-1.5: command-bearing key is position-independent (no postprocessor container anywhere)', () => {
    const config = { a: { b: { c: { commands: ['x'] } } } };
    const violations = findCommandExecutionViolations(config);
    expect(violations).toContainEqual({ rule: 'command-bearing-key', pointer: 'a.b.c.commands' });
  });

  test('T-1.6: the shipped static/config-example.json has zero violations', () => {
    const exampleUrl = new URL('../static/config-example.json', import.meta.url);
    const parsed: unknown = JSON.parse(readFileSync(exampleUrl, 'utf-8'));
    expect(findConfigViolations(parsed)).toEqual([]);
  });

  test('T-1.7: every PROHIBITED_OPTION_IDS entry exists in the options catalog (drift guard)', () => {
    for (const id of PROHIBITED_OPTION_IDS) {
      expect(validOptions.has(id)).toBe(true);
    }
  });

  test('T-1.8: "#" pseudo-comment strings under postprocessor are not treated as references', () => {
    const config = {
      postprocessor: { '#': 'set global archive file for all extractors', content: {} },
    };
    expect(findCommandExecutionViolations(config)).toEqual([]);
  });

  test('T-1.9: nesting past MAX_DEPTH yields a single max-depth-exceeded violation', () => {
    let node: unknown = { leaf: true };
    for (let i = 0; i < 100; i++) {
      node = { nested: node };
    }
    const violations = findConfigViolations(node);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('max-depth-exceeded');
  });
});

describe('exec-policy: R4 path confinement', () => {
  let tmpDataDir: string;
  let tmpDownloadDir: string;

  beforeEach(() => {
    tmpDataDir = mkdtempSync(join(tmpdir(), 'gdluxx-exec-policy-data-'));
    tmpDownloadDir = mkdtempSync(join(tmpdir(), 'gdluxx-exec-policy-download-'));
    process.env.FILE_STORAGE_PATH = tmpDataDir;
    process.env.DOWNLOAD_PATH = tmpDownloadDir;
    delete process.env.GDLUXX_CONFIG_PATH_ROOTS;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDataDir, { recursive: true, force: true });
    rmSync(tmpDownloadDir, { recursive: true, force: true });
  });

  function violationsFor(value: string) {
    return findPathViolations({ extractor: { 'base-directory': value } });
  }

  test('T-1.10: allow matrix — under FILE_STORAGE_PATH, ./data, and DOWNLOAD_PATH', () => {
    expect(violationsFor(join(tmpDataDir, 'downloads'))).toEqual([]);
    expect(violationsFor('./data/x')).toEqual([]);
    expect(violationsFor(join(tmpDownloadDir, 'x'))).toEqual([]);
  });

  test('T-1.10: reject matrix — outside every root, home-relative, traversal, expandable, empty, NUL', () => {
    for (const hostile of [
      '/root/.bashrc',
      '~/x',
      '../../etc',
      '$HOME/x',
      '%APPDATA%\\x',
      '',
      `a${String.fromCharCode(0)}b`,
    ]) {
      expect(violationsFor(hostile).length).toBeGreaterThan(0);
    }
  });

  test('T-1.11: GDLUXX_CONFIG_PATH_ROOTS allows its listed root and nothing else', () => {
    process.env.GDLUXX_CONFIG_PATH_ROOTS = '/mnt/media';
    expect(violationsFor('/mnt/media/gallery')).toEqual([]);
    expect(violationsFor('/mnt/other').length).toBeGreaterThan(0);
  });

  test('T-1.12: dict-form and browser-list-form cookies are not path-checked', () => {
    const dictForm = findPathViolations({
      extractor: { exhentai: { cookies: { ipb_member_id: '1' } } },
    });
    expect(dictForm).toEqual([]);

    const listForm = findPathViolations({ extractor: { x: { cookies: ['firefox'] } } });
    expect(listForm).toEqual([]);
  });
});

describe('exec-policy: prohibited option ids', () => {
  test('T-1.13: a set of entirely permitted ids does not throw', () => {
    expect(() => assertOptionIdsAllowed(['verbose', 'username'])).not.toThrow();
  });

  test('T-1.14: a prohibited id throws ProhibitedOptionError naming only the prohibited id(s)', () => {
    expect(() => assertOptionIdsAllowed(['verbose', 'option'])).toThrow(ProhibitedOptionError);
    try {
      assertOptionIdsAllowed(['verbose', 'option']);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ProhibitedOptionError);
      expect((error as ProhibitedOptionError).optionIds).toEqual(['option']);
    }
  });

  test('isProhibitedOptionId matches exactly the three closed-set ids', () => {
    expect(isProhibitedOptionId('option')).toBe(true);
    expect(isProhibitedOptionId('postprocessor')).toBe(true);
    expect(isProhibitedOptionId('postprocessor-option')).toBe(true);
    expect(isProhibitedOptionId('verbose')).toBe(false);
  });
});
