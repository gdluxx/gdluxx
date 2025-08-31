/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Enables upfront loading to allow instant theme switching

import './developer-tool.css';
import './high-contrast.css';
import './indigo.css';
import './media-downloader.css';
import './media-gallery.css';
import './power-user.css';
import './terminal-dark.css';

export const AVAILABLE_THEME_FILES = [
  'developer-tool',
  'high-contrast',
  'indigo',
  'media-downloader',
  'media-gallery',
  'power-user',
  'terminal-dark',
] as const;

export type ThemeFileName = (typeof AVAILABLE_THEME_FILES)[number];
