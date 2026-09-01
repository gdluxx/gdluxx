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
const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

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
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
}

async function loadExecPolicy(mode: 'restricted' | 'unrestricted') {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
  return import('../src/lib/server/validation/exec-policy');
}

function deeplyNestedConfig(includeIgnoredFindings: boolean): unknown {
  let nested: unknown = { leaf: true };
  for (let i = 0; i < 66; i++) {
    nested = { nested };
  }
  return {
    ...(includeIgnoredFindings && {
      command: ['gdluxx-mode-sentinel'],
      'base-directory': '/gdluxx-mode-sentinel/outside',
    }),
    nested,
  };
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
      const option = validOptions.get(id);
      expect(option).toBeDefined();
      expect(option?.command).toBeTruthy();
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
  test('the canonical set contains exactly the five command-capable option ids', () => {
    expect(Array.from(PROHIBITED_OPTION_IDS)).toEqual([
      'option',
      'postprocessor',
      'postprocessor-option',
      'exec',
      'exec-after',
    ]);
  });

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

  test('isProhibitedOptionId matches the canonical closed set', () => {
    for (const optionId of PROHIBITED_OPTION_IDS) {
      expect(isProhibitedOptionId(optionId)).toBe(true);
    }
    expect(isProhibitedOptionId('verbose')).toBe(false);
  });
});

describe('exec-policy: deployment mode enforcement', () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  test('pure findings and prohibited-id classification are identical in either mode', async () => {
    const config = {
      command: ['gdluxx-mode-sentinel'],
      postprocessor: [{ name: 'exec' }],
      extractor: { 'base-directory': '/gdluxx-mode-sentinel/outside' },
      nested: deeplyNestedConfig(false),
    };
    const restricted = await loadExecPolicy('restricted');
    const restrictedFindings = {
      command: restricted.findCommandExecutionViolations(config),
      path: restricted.findPathViolations(config),
      config: restricted.findConfigViolations(config),
    };

    const unrestricted = await loadExecPolicy('unrestricted');

    expect(unrestricted.findCommandExecutionViolations(config)).toEqual(restrictedFindings.command);
    expect(unrestricted.findPathViolations(config)).toEqual(restrictedFindings.path);
    expect(unrestricted.findConfigViolations(config)).toEqual(restrictedFindings.config);
    for (const optionId of unrestricted.PROHIBITED_OPTION_IDS) {
      expect(restricted.isProhibitedOptionId(optionId)).toBe(true);
      expect(unrestricted.isProhibitedOptionId(optionId)).toBe(true);
    }
    expect(restricted.isProhibitedOptionId('verbose')).toBe(false);
    expect(unrestricted.isProhibitedOptionId('verbose')).toBe(false);
  });

  test('Restricted assertions enforce command, postprocessor, and path findings', async () => {
    const policy = await loadExecPolicy('restricted');

    expect(() => policy.assertCommandExecutionAbsent({ command: ['x'] })).toThrow(
      policy.ProhibitedConfigError,
    );
    expect(() => policy.assertCommandExecutionAbsent({ postprocessor: 'exec' })).toThrow(
      policy.ProhibitedConfigError,
    );
    expect(() =>
      policy.assertPathsConfined({ 'base-directory': '/gdluxx-mode-sentinel/outside' }),
    ).toThrow(policy.ProhibitedConfigError);
    expect(() =>
      policy.assertConfigObjectAllowed({
        command: ['x'],
        postprocessor: 'exec',
        'base-directory': '/gdluxx-mode-sentinel/outside',
      }),
    ).toThrow(policy.ProhibitedConfigError);
  });

  test('Unrestricted assertions ignore only command, postprocessor, and path findings', async () => {
    const policy = await loadExecPolicy('unrestricted');

    expect(() => policy.assertCommandExecutionAbsent({ command: ['x'] })).not.toThrow();
    expect(() => policy.assertCommandExecutionAbsent({ postprocessor: 'exec' })).not.toThrow();
    expect(() =>
      policy.assertPathsConfined({ 'base-directory': '/gdluxx-mode-sentinel/outside' }),
    ).not.toThrow();
    expect(() =>
      policy.assertConfigObjectAllowed({
        command: ['x'],
        postprocessor: 'exec',
        'base-directory': '/gdluxx-mode-sentinel/outside',
      }),
    ).not.toThrow();
  });

  test.each(['restricted', 'unrestricted'] as const)(
    '%s rejects excessive nesting through every configuration assertion',
    async (mode) => {
      const policy = await loadExecPolicy(mode);
      const config = deeplyNestedConfig(true);
      const assertions = [
        policy.assertCommandExecutionAbsent,
        policy.assertPathsConfined,
        policy.assertConfigObjectAllowed,
      ];

      for (const assertion of assertions) {
        try {
          assertion(config);
          expect.unreachable();
        } catch (error) {
          expect(error).toBeInstanceOf(policy.ProhibitedConfigError);
          const rules = (error as InstanceType<typeof policy.ProhibitedConfigError>).violations.map(
            (violation) => violation.rule,
          );
          expect(rules).toContain('max-depth-exceeded');
          if (mode === 'unrestricted') {
            expect(rules).toEqual(['max-depth-exceeded']);
          }
        }
      }
    },
  );

  test.each(['restricted', 'unrestricted'] as const)(
    '%s rejects malformed JSON and non-object roots',
    async (mode) => {
      const policy = await loadExecPolicy(mode);

      for (const content of ['not json {{', 'null', '[]', '"text"', '1']) {
        expect(() => policy.parseConfigText(content)).toThrow(policy.ProhibitedConfigError);
      }
    },
  );

  test('prohibited option assertions are mode-aware without changing classification', async () => {
    const restricted = await loadExecPolicy('restricted');
    const prohibitedIds = Array.from(restricted.PROHIBITED_OPTION_IDS);

    expect(() => restricted.assertOptionIdsAllowed(prohibitedIds)).toThrow(
      restricted.ProhibitedOptionError,
    );

    const unrestricted = await loadExecPolicy('unrestricted');

    expect(() => unrestricted.assertOptionIdsAllowed(prohibitedIds)).not.toThrow();
    for (const optionId of prohibitedIds) {
      expect(unrestricted.isProhibitedOptionId(optionId)).toBe(true);
    }
  });
});
