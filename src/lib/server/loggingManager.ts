/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getCurrentTimestamp } from './settingsManager';
import { openDatabase } from './database';
import { transformLogPath } from './config-utils';
import type { ServerLoggingConfig } from '$lib/logging';

export type { ServerLoggingConfig };

export const DEFAULT_SERVER_LOGGING_CONFIG: ServerLoggingConfig = {
  enabled: true,
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: process.env.NODE_ENV === 'development' ? 'simple' : 'json',
  consoleEnabled: true,
  fileEnabled: process.env.NODE_ENV === 'production',
  fileDirectory: transformLogPath('./logs'),
  fileMaxSize: '10m',
  fileMaxFiles: '7d',
  performanceLogging: true,
  slowQueryThreshold: 1000,
};

// Server logging functions
export async function readServerLoggingConfig(): Promise<ServerLoggingConfig> {
  try {
    const db = openDatabase();
    const stmt = db.prepare(`
			SELECT enabled, level, format, consoleEnabled, fileEnabled, 
			       fileDirectory, fileMaxSize, fileMaxFiles, performanceLogging, 
			       slowQueryThreshold 
			FROM server_logging WHERE id = 1
		`);
    const row = stmt.get() as
      | {
          enabled: number;
          level: string;
          format: string;
          consoleEnabled: number;
          fileEnabled: number;
          fileDirectory: string;
          fileMaxSize: string;
          fileMaxFiles: string;
          performanceLogging: number;
          slowQueryThreshold: number;
        }
      | undefined;
    db.close();

    if (row) {
      return {
        enabled: Boolean(row.enabled),
        level: row.level as ServerLoggingConfig['level'],
        format: row.format as ServerLoggingConfig['format'],
        consoleEnabled: Boolean(row.consoleEnabled),
        fileEnabled: Boolean(row.fileEnabled),
        fileDirectory: transformLogPath(row.fileDirectory),
        fileMaxSize: row.fileMaxSize,
        fileMaxFiles: row.fileMaxFiles,
        performanceLogging: Boolean(row.performanceLogging),
        slowQueryThreshold: row.slowQueryThreshold,
      };
    }

    // defaults if no config exists
    return { ...DEFAULT_SERVER_LOGGING_CONFIG };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to read server logging config:', error);
    // defaults on error
    return { ...DEFAULT_SERVER_LOGGING_CONFIG };
  }
}

export async function writeServerLoggingConfig(config: ServerLoggingConfig): Promise<void> {
  try {
    const db = openDatabase();
    const timestamp = getCurrentTimestamp();

    const stmt = db.prepare(`
			INSERT OR REPLACE INTO server_logging (
				id, enabled, level, format, consoleEnabled, fileEnabled,
				fileDirectory, fileMaxSize, fileMaxFiles, performanceLogging,
				slowQueryThreshold, createdAt, updatedAt
			) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

    stmt.run(
      config.enabled ? 1 : 0,
      config.level,
      config.format,
      config.consoleEnabled ? 1 : 0,
      config.fileEnabled ? 1 : 0,
      config.fileDirectory,
      config.fileMaxSize,
      config.fileMaxFiles,
      config.performanceLogging ? 1 : 0,
      config.slowQueryThreshold,
      timestamp,
      timestamp,
    );

    db.close();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to write server logging config:', error);
    throw error;
  }
}

// Log directory validation now lives in `$lib/logging` (validateLogDirectory)
// so the endpoint, the settings UI, and the log tail all apply identical rules.

// called when logger is initiated to ensure paths work in Docker and non-docker environments
export function getTransformedLoggingConfig(config: ServerLoggingConfig): ServerLoggingConfig {
  return {
    ...config,
    fileDirectory: transformLogPath(config.fileDirectory),
  };
}
