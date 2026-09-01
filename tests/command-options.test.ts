/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { OptionWithSource } from '$lib/types/command-form';
import type { Option } from '$lib/types/options';
import {
  allOptions,
  getOptionCapability,
  hasRestrictedProhibitedSelection,
  hasRestrictedProhibitedUserSelection,
  initialOptionValue,
  isValidRangeValue,
} from '$lib/utils/commandOptions';

const loggerWarnMock = vi.fn();
vi.mock('$lib/server/logger', () => ({
  serverLogger: {
    info: vi.fn(),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { validateAndBuildCliArgs } = await import('$lib/server/validation/option-validation');
const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

afterEach(() => {
  loggerWarnMock.mockClear();
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
  vi.resetModules();
});

async function loadOptionValidation(mode: 'restricted' | 'unrestricted') {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
  const optionValidation = await import('$lib/server/validation/option-validation');
  const execPolicy = await import('$lib/server/validation/exec-policy');
  return { optionValidation, execPolicy };
}

describe('option capabilities', () => {
  test.each([
    {
      mode: 'restricted' as const,
      prohibited: true,
      selected: true,
      expected: { canAdd: false, canEdit: false, canRemove: true },
    },
    {
      mode: 'restricted' as const,
      prohibited: true,
      selected: false,
      expected: { canAdd: false, canEdit: false, canRemove: false },
    },
    {
      mode: 'restricted' as const,
      prohibited: false,
      selected: true,
      expected: { canAdd: true, canEdit: true, canRemove: true },
    },
    {
      mode: 'restricted' as const,
      prohibited: false,
      selected: false,
      expected: { canAdd: true, canEdit: true, canRemove: true },
    },
    {
      mode: 'unrestricted' as const,
      prohibited: true,
      selected: false,
      expected: { canAdd: true, canEdit: true, canRemove: true },
    },
  ])('$mode mode, prohibited=$prohibited, selected=$selected', (scenario) => {
    expect(getOptionCapability(scenario.mode, scenario.prohibited, scenario.selected)).toEqual(
      scenario.expected,
    );
  });
});

describe('restricted prohibited selections', () => {
  const prohibitedOptionIds = ['exec', 'exec-after'];

  test('blocks until every prohibited active selection is absent', () => {
    const selected = new Map<string, OptionWithSource>([
      ['exec', { value: 'command', source: 'site-config' }],
      ['write-metadata', { value: true, source: 'user' }],
    ]);

    expect(hasRestrictedProhibitedSelection('restricted', prohibitedOptionIds, selected)).toBe(
      true,
    );

    selected.delete('exec');

    expect(hasRestrictedProhibitedSelection('restricted', prohibitedOptionIds, selected)).toBe(
      false,
    );
  });

  test('never blocks in Unrestricted mode', () => {
    const selected = new Map<string, OptionWithSource>([
      ['exec', { value: 'command', source: 'user' }],
    ]);

    expect(hasRestrictedProhibitedSelection('unrestricted', prohibitedOptionIds, selected)).toBe(
      false,
    );
  });

  test('the user-only predicate ignores Site Rule-sourced prohibited options', () => {
    const selected = new Map<string, OptionWithSource>([
      ['exec', { value: 'site-command', source: 'site-config' }],
      ['write-metadata', { value: true, source: 'user' }],
    ]);

    expect(hasRestrictedProhibitedSelection('restricted', prohibitedOptionIds, selected)).toBe(
      true,
    );
    expect(hasRestrictedProhibitedUserSelection('restricted', prohibitedOptionIds, selected)).toBe(
      false,
    );

    selected.set('exec-after', { value: 'user-command', source: 'user' });

    expect(hasRestrictedProhibitedUserSelection('restricted', prohibitedOptionIds, selected)).toBe(
      true,
    );
    expect(
      hasRestrictedProhibitedUserSelection('unrestricted', prohibitedOptionIds, selected),
    ).toBe(false);
  });
});

describe('initialOptionValue', () => {
  const booleanOptions = allOptions.filter((option) => option.type === 'boolean');

  test('the catalog has boolean options to check', () => {
    expect(booleanOptions.length).toBeGreaterThan(0);
  });

  // Regression test: `defaultValue ?? ...` does not fall through on `false`,
  // so a catalog default of `false` must not suppress the `true` toggle-on value.
  test('every boolean option toggles on to true, regardless of its catalog defaultValue', () => {
    for (const option of booleanOptions) {
      expect(initialOptionValue(option)).toBe(true);
    }
  });

  test('a non-boolean option with a defaultValue returns that defaultValue', () => {
    const option: Option = {
      id: 'test-string',
      command: '--test-string',
      description: 'test',
      type: 'string',
      defaultValue: 'preset',
    };
    expect(initialOptionValue(option)).toBe('preset');
  });

  test('a non-boolean option without a defaultValue returns an empty string', () => {
    const option: Option = {
      id: 'test-number',
      command: '--test-number',
      description: 'test',
      type: 'number',
    };
    expect(initialOptionValue(option)).toBe('');
  });
});

describe('isValidRangeValue', () => {
  test.each([
    '5',
    '8-20',
    '1:24:3',
    '10-',
    '-5',
    '-',
    ':',
    '1:2,4:8:2',
    '1-10,25,30-',
    '5,',
    ' - 3 , 4-  4, 2-6',
  ])('accepts %j', (value) => {
    expect(isValidRangeValue(value)).toBe(true);
  });

  test.each(['', ',', '8–20', '5 to 10', '1-2-3', '1-5:2', '1:2-3', 'abc', '1 0', '5..8'])(
    'rejects %j',
    (value) => {
      expect(isValidRangeValue(value)).toBe(false);
    },
  );
});

describe('validateAndBuildCliArgs: boolean flag emission', () => {
  test('a boolean option set to true emits its CLI flag', () => {
    const args = validateAndBuildCliArgs(new Map([['no-skip', true]]));
    expect(args).toContain('--no-skip');
  });

  test('a boolean option set to false omits its CLI flag', () => {
    const args = validateAndBuildCliArgs(new Map([['no-skip', false]]));
    expect(args).not.toContain('--no-skip');
  });
});

describe('validateAndBuildCliArgs: command-capable options', () => {
  test('Restricted rejects every canonical prohibited option id', async () => {
    const { optionValidation, execPolicy } = await loadOptionValidation('restricted');
    const args = new Map(
      Array.from(execPolicy.PROHIBITED_OPTION_IDS, (optionId) => [optionId, 'value'] as const),
    );

    expect(() => optionValidation.validateAndBuildCliArgs(args)).toThrow(
      execPolicy.ProhibitedOptionError,
    );
  });

  test('Unrestricted builds exact argv pairs for exec and exec-after', async () => {
    const { optionValidation } = await loadOptionValidation('unrestricted');

    expect(
      optionValidation.validateAndBuildCliArgs(
        new Map([
          ['exec', 'per-file-command'],
          ['exec-after', 'final-command'],
        ]),
      ),
    ).toEqual(['--exec', 'per-file-command', '--exec-after', 'final-command']);
  });

  test('a Run value replaces a Site Rule value for the same option id', async () => {
    const { optionValidation } = await loadOptionValidation('unrestricted');
    const siteOptions = new Map([['exec', 'site-command']]);
    const runOptions = new Map([['exec', 'run-command']]);
    const merged = new Map([...siteOptions, ...runOptions]);

    expect(optionValidation.validateAndBuildCliArgs(merged)).toEqual(['--exec', 'run-command']);
  });
});

describe('option value redaction', () => {
  test('the redaction flag set equals catalog-sensitive flags plus canonical prohibited flags', async () => {
    const { optionValidation, execPolicy } = await loadOptionValidation('restricted');
    const prohibitedCommands = Array.from(
      execPolicy.PROHIBITED_OPTION_IDS,
      (optionId) => optionValidation.validOptions.get(optionId)?.command,
    );
    expect(prohibitedCommands).not.toContain(undefined);
    const expected = new Set([
      ...optionValidation.sensitiveCommands,
      ...(prohibitedCommands as string[]),
    ]);

    expect(Array.from(optionValidation.redactedValueCommands).sort()).toEqual(
      Array.from(expected).sort(),
    );
  });

  test('every command-capable and catalog-sensitive option value is redacted', async () => {
    const { optionValidation } = await loadOptionValidation('restricted');
    const sentinel = 'unique-command-value-sentinel-91f2';

    expect(optionValidation.redactedValueCommands).toContain('--exec');
    expect(optionValidation.redactedValueCommands).toContain('--exec-after');
    for (const command of optionValidation.redactedValueCommands) {
      const redacted = optionValidation.redactSensitiveArgs([command, sentinel]);
      expect(redacted).toEqual([command, '[REDACTED]']);
      expect(redacted).not.toContain(sentinel);
    }
  });

  test('invalid known-option warnings contain the option id but never the rejected value', async () => {
    const { optionValidation } = await loadOptionValidation('restricted');
    const sentinel = 'unique-invalid-option-value-sentinel-a72c';

    expect(optionValidation.validateAndBuildCliArgs(new Map([['no-skip', sentinel]]))).toEqual([]);
    expect(loggerWarnMock).toHaveBeenCalledWith('Invalid value for option no-skip');
    expect(JSON.stringify(loggerWarnMock.mock.calls)).not.toContain(sentinel);
  });
});
