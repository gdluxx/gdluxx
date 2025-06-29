/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import path from 'path';

// Common variables

function getCwd(): string {
  if (typeof process === 'undefined' || !process.cwd) {
    return '.';
  }
  try {
    return process.cwd();
  } catch {
    return '.';
  }
}

let _paths: ReturnType<typeof createPaths> | null = null;

function createPaths() {
  const cwd = getCwd();
  return {
    BIN_FILE: path.join(cwd, 'data', 'gallery-dl.bin'),
    DATA_DIR: path.join(cwd, 'data'),
    CONFIG_FILE: './data/config.json',
    API_KEYS_FILE: path.join(cwd, 'data', 'api-keys.json'),
  } as const;
}

function getPaths() {
  if (!_paths) {
    _paths = createPaths();
  }
  return _paths;
}

export const PATHS = {
  get BIN_FILE() {
    return getPaths().BIN_FILE;
  },
  get DATA_DIR() {
    return getPaths().DATA_DIR;
  },
  get CONFIG_FILE() {
    return getPaths().CONFIG_FILE;
  },
  get API_KEYS_FILE() {
    return getPaths().API_KEYS_FILE;
  },
} as const;

export const TERMINAL = {
  NAME: 'xterm-256color',
  COLS: 120,
  ROWS: 30,
} as const;

export const GITHUB = {
  USER: 'mikf',
  REPO: 'gallery-dl',
  get LATEST_RELEASE_URL() {
    return `https://api.github.com/repos/${this.USER}/${this.REPO}/releases/latest`;
  },
  get BINARY_DOWNLOAD_URL() {
    return `https://github.com/${this.USER}/${this.REPO}/releases/latest/download/gallery-dl.bin`;
  },
} as const;
