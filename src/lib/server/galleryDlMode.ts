/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { GalleryDlMode } from '$lib/types/gallery-dl-mode';

export function resolveGalleryDlMode(raw: string | undefined): {
  mode: GalleryDlMode;
  invalid: boolean;
} {
  if (raw === 'unrestricted') {
    return { mode: 'unrestricted', invalid: false };
  }
  if (raw === undefined || raw === '' || raw === 'restricted') {
    return { mode: 'restricted', invalid: false };
  }
  return { mode: 'restricted', invalid: true };
}

const resolvedGalleryDlMode = resolveGalleryDlMode(process.env.GDLUXX_GDL_POLICY);

export const GALLERY_DL_MODE: GalleryDlMode = resolvedGalleryDlMode.mode;
export const GALLERY_DL_MODE_INVALID: boolean = resolvedGalleryDlMode.invalid;
export const GALLERY_DL_MODE_INVALID_WARNING =
  "Invalid GDLUXX_GDL_POLICY value. Only the exact value 'unrestricted' enables Unrestricted mode; this process is running Restricted.";
