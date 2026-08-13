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
import { isUnsupportedUrlExit } from '../src/lib/server/jobs/galleryDlExit';

describe('isUnsupportedUrlExit', () => {
  test.each([64, 65, 68, 96, 192])(
    'returns true for exit code %i (NO_EXTRACTOR bit set, mask not equality)',
    (exitCode) => {
      expect(isUnsupportedUrlExit(exitCode)).toBe(true);
    },
  );

  test.each([0, 1, 4, 8, 16, 32, 128])(
    'returns false for exit code %i (NO_EXTRACTOR bit not set)',
    (exitCode) => {
      expect(isUnsupportedUrlExit(exitCode)).toBe(false);
    },
  );

  test.each([NaN, 1.5])('returns false for invalid exit code %p', (exitCode) => {
    expect(isUnsupportedUrlExit(exitCode)).toBe(false);
  });

  test.each([-1, -64, -128])(
    'returns false for negative exit code %p despite the bitmask',
    (exitCode) => {
      expect(isUnsupportedUrlExit(exitCode)).toBe(false);
    },
  );
});
