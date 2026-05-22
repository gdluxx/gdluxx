/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, setValue } from './storage';
import type { GallerizedSettings } from '#src/content/types';

export const GALLERIZED_STORAGE_KEY = 'gallerized_settings';

export const DEFAULT_GALLERIZED_SETTINGS: GallerizedSettings = {
  enabled: false,
  defaultConfig: {
    container: { selector: null, begin: null, end: null },
    images: { selector: 'img', attr: 'src', begin: null, end: null, transform: null },
    gallery: {
      thumbSizes: [150, 200, 300],
      gap: 12,
      border: 30,
      buttonCorner: 'bottom-right',
    },
  },
  profiles: [],
};

export async function loadGallerizedSettings(): Promise<GallerizedSettings> {
  return getValue<GallerizedSettings>(GALLERIZED_STORAGE_KEY, DEFAULT_GALLERIZED_SETTINGS);
}

export async function saveGallerizedSettings(settings: GallerizedSettings): Promise<void> {
  await setValue(GALLERIZED_STORAGE_KEY, settings);
}
