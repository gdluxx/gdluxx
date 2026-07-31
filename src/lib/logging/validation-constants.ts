/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export const LOG_FORMATS = ['simple', 'json'] as const;

export const LOG_LEVEL_LABELS: Record<(typeof LOG_LEVELS)[number], string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Warning',
  error: 'Error',
};

export const LOG_FORMAT_LABELS: Record<(typeof LOG_FORMATS)[number], string> = {
  simple: 'Simple',
  json: 'JSON',
};

export const LOG_VALIDATION = {
  DIRECTORY: {
    MAX_LENGTH: 255,
    INVALID_CHARS: /[<>:"|?*]/,
    REQUIRED_MESSAGE: 'Log directory is required when file output is enabled',
    LENGTH_MESSAGE: 'Log directory must be at most 255 characters',
    TRAVERSAL_MESSAGE: 'Log directory may not contain ".."',
    CHARSET_MESSAGE: 'Log directory may not contain < > : " | ? or *',
  },
  MAX_SIZE: {
    PATTERN: /^(?:0\.)?\d+[kmgKMG]$/,
    MESSAGE: 'Use a number with a unit: k, m, or g (e.g. 10m). Leave blank for no size limit.',
  },
  MAX_FILES: {
    PATTERN: /^\d+d?$/,
    MESSAGE:
      "Use days with a lowercase 'd' suffix (e.g. 7d) or a file count (e.g. 14). Leave blank to keep every file.",
  },
  SLOW_QUERY_THRESHOLD: {
    MIN: 0,
    MAX: 600_000,
    RANGE_MESSAGE: 'Slow query threshold must be between 0 and 600000 milliseconds',
    INTEGER_MESSAGE: 'Slow query threshold must be a whole number of milliseconds',
  },
} as const;

export const LOG_FILE_PATTERN = /^gdluxx-\d{4}-\d{2}-\d{2}\.log(?:\.\d+)?$/;
