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

const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

function restoreGalleryDlModeEnv(): void {
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
}

afterEach(() => {
  restoreGalleryDlModeEnv();
  vi.resetModules();
});

describe('resolveGalleryDlMode', () => {
  test.each([
    [undefined, { mode: 'restricted', invalid: false }],
    ['', { mode: 'restricted', invalid: false }],
    ['restricted', { mode: 'restricted', invalid: false }],
    ['unrestricted', { mode: 'unrestricted', invalid: false }],
  ] as const)('resolves %s exactly', async (raw, expected) => {
    const { resolveGalleryDlMode } = await import('../src/lib/server/galleryDlMode');

    expect(resolveGalleryDlMode(raw)).toEqual(expected);
  });

  test.each([' unrestricted', 'Unrestricted', 'UNRESTRICTED', 'unrestricted ', 'true', 'yes', '1'])(
    'fails closed for invalid value %j',
    async (raw) => {
      const { resolveGalleryDlMode } = await import('../src/lib/server/galleryDlMode');

      expect(resolveGalleryDlMode(raw)).toEqual({ mode: 'restricted', invalid: true });
    },
  );

  test('warning is fixed and never includes the invalid raw value', async () => {
    const sentinel = 'unique-raw-value-sentinel-7f4d2';
    process.env.GDLUXX_GDL_POLICY = sentinel;
    vi.resetModules();

    const modeModule = await import('../src/lib/server/galleryDlMode');

    expect(modeModule.GALLERY_DL_MODE).toBe('restricted');
    expect(modeModule.GALLERY_DL_MODE_INVALID).toBe(true);
    expect(modeModule.GALLERY_DL_MODE_INVALID_WARNING).toContain('GDLUXX_GDL_POLICY');
    expect(modeModule.GALLERY_DL_MODE_INVALID_WARNING).toContain('unrestricted');
    expect(modeModule.GALLERY_DL_MODE_INVALID_WARNING).not.toContain(sentinel);
  });
});

describe('process-constant gallery-dl mode', () => {
  test('changes only after a fresh module graph', async () => {
    delete process.env.GDLUXX_GDL_POLICY;
    vi.resetModules();
    const initialModule = await import('../src/lib/server/galleryDlMode');

    expect(initialModule.GALLERY_DL_MODE).toBe('restricted');
    expect(initialModule.GALLERY_DL_MODE_INVALID).toBe(false);

    process.env.GDLUXX_GDL_POLICY = 'unrestricted';
    const cachedModule = await import('../src/lib/server/galleryDlMode');

    expect(cachedModule).toBe(initialModule);
    expect(cachedModule.GALLERY_DL_MODE).toBe('restricted');

    vi.resetModules();
    const restartedModule = await import('../src/lib/server/galleryDlMode');

    expect(restartedModule.GALLERY_DL_MODE).toBe('unrestricted');
    expect(restartedModule.GALLERY_DL_MODE_INVALID).toBe(false);
  });
});
