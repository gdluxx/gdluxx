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
import { arch } from 'node:os';

const isArm64 = arch() === 'arm64';

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
    CONFIG_FILE: path.join(cwd, 'data', 'config.json'),
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
} as const;

export const TERMINAL = {
  NAME: 'xterm-256color',
  COLS: 120,
  ROWS: 30,
} as const;

export const GITHUB = {
  USER: 'mikf',
  REPO: 'gallery-dl',
  ARM64_USER: 'gdluxx',
  ARM64_REPO: 'gdl-arm',

  get IS_ARM64() {
    return isArm64;
  },
  get ACTIVE_USER() {
    return isArm64 ? this.ARM64_USER : this.USER;
  },
  get ACTIVE_REPO() {
    return isArm64 ? this.ARM64_REPO : this.REPO;
  },
  get LATEST_RELEASE_URL() {
    return `https://api.github.com/repos/${this.ACTIVE_USER}/${this.ACTIVE_REPO}/releases/latest`;
  },
  get BINARY_DOWNLOAD_URL() {
    return `https://github.com/${this.ACTIVE_USER}/${this.ACTIVE_REPO}/releases/latest/download/gallery-dl.bin`;
  },
} as const;

export const API_LIMITS = {
  MAX_BATCH_URLS: 200,
} as const;
