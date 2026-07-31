/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { z } from 'zod';
import { LOG_FORMATS, LOG_LEVELS, LOG_VALIDATION } from './validation-constants';
import type { ServerLoggingConfig } from './types';

// Per-field validators. Each returns an error message, or null when valid.
// These are the single source of truth: the Zod schema below and the inline
// field errors in the settings UI both go through them.

export function validateLogDirectory(directory: string, fileEnabled = true): string | null {
  const value = directory ?? '';

  if (!value.trim()) {
    // An empty directory only matters when logs are actually written to disk.
    return fileEnabled ? LOG_VALIDATION.DIRECTORY.REQUIRED_MESSAGE : null;
  }

  if (value.includes('..')) {
    return LOG_VALIDATION.DIRECTORY.TRAVERSAL_MESSAGE;
  }

  if (value.length > LOG_VALIDATION.DIRECTORY.MAX_LENGTH) {
    return LOG_VALIDATION.DIRECTORY.LENGTH_MESSAGE;
  }

  if (LOG_VALIDATION.DIRECTORY.INVALID_CHARS.test(value)) {
    return LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE;
  }

  return null;
}

export function validateLogMaxSize(maxSize: string): string | null {
  const value = maxSize ?? '';

  // Blank is a valid "no size limit" configuration.
  if (value.trim() === '') {
    return null;
  }

  return LOG_VALIDATION.MAX_SIZE.PATTERN.test(value.trim())
    ? null
    : LOG_VALIDATION.MAX_SIZE.MESSAGE;
}

export function validateLogMaxFiles(maxFiles: string): string | null {
  const value = maxFiles ?? '';

  // Blank is a valid "keep every file" configuration.
  if (value.trim() === '') {
    return null;
  }

  return LOG_VALIDATION.MAX_FILES.PATTERN.test(value.trim())
    ? null
    : LOG_VALIDATION.MAX_FILES.MESSAGE;
}

export function validateSlowQueryThreshold(threshold: number): string | null {
  if (!Number.isFinite(threshold)) {
    return LOG_VALIDATION.SLOW_QUERY_THRESHOLD.RANGE_MESSAGE;
  }

  if (!Number.isInteger(threshold)) {
    return LOG_VALIDATION.SLOW_QUERY_THRESHOLD.INTEGER_MESSAGE;
  }

  if (
    threshold < LOG_VALIDATION.SLOW_QUERY_THRESHOLD.MIN ||
    threshold > LOG_VALIDATION.SLOW_QUERY_THRESHOLD.MAX
  ) {
    return LOG_VALIDATION.SLOW_QUERY_THRESHOLD.RANGE_MESSAGE;
  }

  return null;
}

// Unknown keys are rejected (`.strict()`): the client builds the payload from
// exactly these keys, and silently persisting extras would let a stale or
// hostile client widen the stored row.
export const serverLoggingConfigSchema = z
  .object({
    enabled: z.boolean(),
    level: z.enum(LOG_LEVELS),
    format: z.enum(LOG_FORMATS),
    consoleEnabled: z.boolean(),
    fileEnabled: z.boolean(),
    fileDirectory: z.string().trim(),
    fileMaxSize: z.string().trim(),
    fileMaxFiles: z.string().trim(),
    performanceLogging: z.boolean(),
    slowQueryThreshold: z.number({ error: LOG_VALIDATION.SLOW_QUERY_THRESHOLD.RANGE_MESSAGE }),
  })
  .strict()
  .superRefine((config, ctx) => {
    const checks: Array<[keyof ServerLoggingConfig, string | null]> = [
      ['fileDirectory', validateLogDirectory(config.fileDirectory, config.fileEnabled)],
      ['fileMaxSize', validateLogMaxSize(config.fileMaxSize)],
      ['fileMaxFiles', validateLogMaxFiles(config.fileMaxFiles)],
      ['slowQueryThreshold', validateSlowQueryThreshold(config.slowQueryThreshold)],
    ];

    for (const [field, message] of checks) {
      if (message) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }
    }
  });

export type ServerLoggingConfigInput = z.infer<typeof serverLoggingConfigSchema>;

export type ServerLoggingFieldErrors = Partial<Record<keyof ServerLoggingConfig, string>>;

export type ServerLoggingValidationResult =
  | { valid: true; data: ServerLoggingConfig }
  | { valid: false; fieldErrors: ServerLoggingFieldErrors };

// UI-facing wrapper: same rules as the endpoint, shaped for inline per-field
// errors instead of a single flattened message.
export function validateServerLoggingConfig(config: unknown): ServerLoggingValidationResult {
  const result = serverLoggingConfigSchema.safeParse(config);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const fieldErrors: ServerLoggingFieldErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in fieldErrors)) {
      fieldErrors[field as keyof ServerLoggingConfig] = issue.message;
    }
  }

  return { valid: false, fieldErrors };
}
