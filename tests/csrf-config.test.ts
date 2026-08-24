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

describe('svelte.config.js (REM-013: DISABLE_CSRF_CHECK wildcard removed)', () => {
  test('DISABLE_CSRF_CHECK=true no longer yields a csrf override', async () => {
    process.env.DISABLE_CSRF_CHECK = 'true';
    try {
      const { default: config } = await import('../svelte.config.js');
      expect(config.kit?.csrf).toBeUndefined();
    } finally {
      delete process.env.DISABLE_CSRF_CHECK;
    }
  });
});
