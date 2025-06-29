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
import Database from 'better-sqlite3';
import { PATHS } from '$lib/server/constants';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

export interface LoggingConfig {
  enabled: boolean;
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  enabled: process.env.NODE_ENV === 'development',
  level: 'INFO',
};

function getCurrentTimestamp(): number {
  return Date.now();
}

export async function readLoggingConfig(): Promise<LoggingConfig> {
  try {
    const stmt = db.prepare('SELECT enabled, level FROM logging WHERE id = 1');
    const row = stmt.get() as { enabled: number; level: string } | undefined;

    if (row) {
      return {
        enabled: Boolean(row.enabled),
        level: row.level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
      };
    }
    return { ...DEFAULT_LOGGING_CONFIG };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading logging config from database:', error);
    return { ...DEFAULT_LOGGING_CONFIG };
  }
}

export async function writeLoggingConfig(config: LoggingConfig): Promise<void> {
  try {
    const now = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO logging (id, enabled, level, createdAt, updatedAt)
      VALUES (1, ?, ?, 
        COALESCE((SELECT createdAt FROM logging WHERE id = 1), ?),
        ?)
    `);

    stmt.run(config.enabled ? 1 : 0, config.level || 'INFO', now, now);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error writing logging config to database:', error);
    throw new Error('Failed to write logging configuration.');
  }
}
