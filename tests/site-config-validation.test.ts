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

// site-config-validation.ts delegates known-id value checks to
// option-validation.ts, which imports the real serverLogger; that module's
// chain (loggingManager -> settingsManager -> database) reaches
// $app/environment, unavailable outside SvelteKit.
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { validateCliOptionValue } from '../src/lib/server/validation/site-config-validation';

describe('validateCliOptionValue', () => {
  test('rejects false for a boolean-typed option ("no-skip")', () => {
    expect(validateCliOptionValue('no-skip', false)).toBe(false);
  });

  test('accepts true for a boolean-typed option ("no-skip")', () => {
    expect(validateCliOptionValue('no-skip', true)).toBe(true);
  });

  test('rejects a non-boolean value for a boolean-typed option ("no-skip")', () => {
    expect(validateCliOptionValue('no-skip', 'yes')).toBe(false);
  });

  test('rejects a number value for a known string-typed option ("filename")', () => {
    expect(validateCliOptionValue('filename', 123)).toBe(false);
  });

  test('accepts a valid string value for a known string-typed option ("filename")', () => {
    expect(validateCliOptionValue('filename', '%Y-%m-%d')).toBe(true);
  });

  test('rejects a numeric value for a range-typed option ("range")', () => {
    expect(validateCliOptionValue('range', 5)).toBe(false);
  });

  test('rejects an object value for a range-typed option ("range")', () => {
    expect(validateCliOptionValue('range', {})).toBe(false);
  });

  test('rejects a boolean value for a range-typed option ("range")', () => {
    expect(validateCliOptionValue('range', true)).toBe(false);
  });

  test('accepts a valid string value for a range-typed option ("range")', () => {
    expect(validateCliOptionValue('range', '5, 8-20')).toBe(true);
  });

  test('rejects an unknown option id regardless of value', () => {
    expect(validateCliOptionValue('definitely-not-real', 'x')).toBe(false);
  });

  test('rejects an empty string for a number-typed option ("retries")', () => {
    expect(validateCliOptionValue('retries', '')).toBe(false);
  });
});
