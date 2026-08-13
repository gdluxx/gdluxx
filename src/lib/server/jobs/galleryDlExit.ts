/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const GALLERY_DL_EXIT_BITS = {
  GENERAL: 1,
  EXTRACTION: 4,
  CHALLENGE: 8,
  AUTH: 16,
  INPUT: 32,
  NO_EXTRACTOR: 64,
  OS: 128,
} as const;

export function isUnsupportedUrlExit(exitCode: number): boolean {
  return (
    Number.isInteger(exitCode) &&
    exitCode >= 0 &&
    (exitCode & GALLERY_DL_EXIT_BITS.NO_EXTRACTOR) !== 0
  );
}
