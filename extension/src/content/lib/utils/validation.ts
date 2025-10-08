/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export function validateSelector(selector: string): string {
  if (!selector.trim()) return '';

  if (typeof document === 'undefined') {
    return '';
  }

  try {
    document.querySelector(selector);
    return '';
  } catch {
    return 'Invalid CSS selector';
  }
}

// For safe directory names - should work on all (can't test windows or mac though)
// Disallow \ / : * ? " < > | and control characters
// Allow a-z A-Z 0-9 _ - . and spaces
export const DIRECTORY_NAME_PATTERN = /^[a-zA-Z0-9_\-. ]+$/;

export function isValidDirectoryName(name: string): boolean {
  const trimmed = name.trim();
  return !trimmed || DIRECTORY_NAME_PATTERN.test(trimmed);
}
