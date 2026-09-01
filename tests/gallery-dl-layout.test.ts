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
import { GALLERY_DL_MODE } from '$lib/server/galleryDlMode';
import { PROHIBITED_OPTION_IDS } from '$lib/server/validation/exec-policy';
import { load } from '../src/routes/+layout.server';

vi.mock('$lib/server/appVersion', () => ({ APP_VERSION: 'test-version' }));

describe('root layout deployment posture data', () => {
  test('authenticated data includes the effective mode and prohibited option ids', async () => {
    const user = { id: 'test-user' };
    const result = (await load({ locals: { user } } as never)) as Record<string, unknown>;

    expect(result).toEqual({
      user,
      appVersion: 'test-version',
      galleryDlMode: GALLERY_DL_MODE,
      prohibitedOptionIds: Array.from(PROHIBITED_OPTION_IDS),
    });
  });

  test('unauthenticated data omits deployment posture keys', async () => {
    const result = (await load({ locals: { user: undefined } } as never)) as Record<
      string,
      unknown
    >;

    expect(result).toEqual({ user: undefined, appVersion: 'test-version' });
    expect(Object.hasOwn(result, 'galleryDlMode')).toBe(false);
    expect(Object.hasOwn(result, 'prohibitedOptionIds')).toBe(false);
  });
});
