/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Splits raw textarea/input content into a list of trimmed, non-empty URLs.
 * URLs may be separated by any combination of whitespace and newlines.
 */
export function parseUrls(input: string): string[] {
  return input
    .split(/[\s\n]+/)
    .map((url) => url.trim())
    .filter((url) => url !== '');
}
