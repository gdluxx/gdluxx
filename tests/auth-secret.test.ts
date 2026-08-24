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
import { assertAuthSecretConfigured } from '$lib/server/environment';

const CONFIGURED_TEST_SECRET = 'auth-secret-test-value-not-for-prod-0123456789';

describe('assertAuthSecretConfigured (REM-004: fail-closed AUTH_SECRET)', () => {
  test.each([
    ['an unset', undefined],
    ['an empty', ''],
    ['a whitespace-only', '   '],
    [
      'the better-auth fallback placeholder as the',
      'fallback-secret-please-set-AUTH_SECRET-in-production',
    ],
    ['the .env.example placeholder as the', 'your-super-secret-auth-key-change-this'],
  ])('production with %s secret aborts boot', (_label, secret) => {
    expect(() => assertAuthSecretConfigured(secret, 'production')).toThrow(/AUTH_SECRET/);
  });

  test('production with a configured secret does not abort', () => {
    expect(() => assertAuthSecretConfigured(CONFIGURED_TEST_SECRET, 'production')).not.toThrow();
  });

  test('non-production with an unset secret does not abort', () => {
    expect(() => assertAuthSecretConfigured(undefined, 'development')).not.toThrow();
    expect(() => assertAuthSecretConfigured(undefined, 'test')).not.toThrow();
    expect(() => assertAuthSecretConfigured(undefined, undefined)).not.toThrow();
  });

  test('non-production with a placeholder secret does not abort', () => {
    expect(() =>
      assertAuthSecretConfigured('your-super-secret-auth-key-change-this', 'development'),
    ).not.toThrow();
  });
});
