/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { LOG_FORMATS, LOG_LEVELS } from './validation-constants';

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogFormat = (typeof LOG_FORMATS)[number];

export interface ServerLoggingConfig {
  enabled: boolean;
  level: LogLevel;
  format: LogFormat;
  consoleEnabled: boolean;
  fileEnabled: boolean;
  fileDirectory: string;
  fileMaxSize: string;
  fileMaxFiles: string;
  performanceLogging: boolean;
  slowQueryThreshold: number;
}

// Client-side fallback used before/if the server config fails to load. The
// server-side default (which applies Docker path transformation and keys off
// NODE_ENV) lives in `$lib/server/loggingManager`.
export const DEFAULT_SERVER_LOGGING_UI_CONFIG: ServerLoggingConfig = {
  enabled: true,
  level: 'info',
  format: 'json',
  consoleEnabled: true,
  fileEnabled: false,
  fileDirectory: './logs',
  fileMaxSize: '10m',
  fileMaxFiles: '7d',
  performanceLogging: true,
  slowQueryThreshold: 1000,
};

// Log tail (read-only viewer for the most recent server log file)

export type LogTailReason =
  | 'file-logging-disabled'
  | 'invalid-directory'
  | 'directory-missing'
  | 'unreadable'
  | 'no-log-files';

export interface LogTailResult {
  available: boolean;
  reason?: LogTailReason;
  loggingEnabled: boolean;
  file: string | null;
  modifiedAt: string | null;
  sizeBytes: number;
  lineCount: number;
  truncated: boolean;
  lines: string[];
}
