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
import { allOptions, initialOptionValue } from '$lib/utils/commandOptions';

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
