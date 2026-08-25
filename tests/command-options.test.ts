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
import type { Option } from '$lib/types/options';
import { allOptions, initialOptionValue, isValidRangeValue } from '$lib/utils/commandOptions';

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { validateAndBuildCliArgs } = await import('$lib/server/validation/option-validation');

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
