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
import { serverLogger } from '$lib/server/logger';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function createSettingsManager<T>(
  tableName: string,
  defaults: T,
  transformer?: (row: Record<string, unknown>) => T
) {
  return {
    read: async (): Promise<T> => {
      try {
        const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = 1`);
        const row = stmt.get() as Record<string, unknown> | undefined;

        if (row) {
          return transformer ? transformer(row) : (row as T);
        }
        return { ...defaults };
      } catch (error) {
        serverLogger.error('Error reading config from database:', { tableName, error });
        return { ...defaults };
      }
    },

    write: async (data: T): Promise<void> => {
      try {
        const now = getCurrentTimestamp();
        const dataObj = data as Record<string, unknown>;
        const columns = Object.keys(dataObj);
        const placeholders = columns.map(() => '?').join(', ');

        const values = Object.values(dataObj).map(value => {
          if (typeof value === 'boolean') {
            return value ? 1 : 0;
          }
          if (value === null || value === undefined) {
            return null;
          }
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return value;
        });

        const stmt = db.prepare(`
					INSERT OR REPLACE INTO ${tableName} (id, ${columns.join(', ')}, createdAt, updatedAt)
					VALUES (1, ${placeholders}, 
						COALESCE((SELECT createdAt FROM ${tableName} WHERE id = 1), ?),
						?)
				`);

        stmt.run(...values, now, now);
      } catch (error) {
        serverLogger.error('Error writing config to database:', { tableName, error });
        throw new Error(`Failed to write ${tableName} configuration.`);
      }
    },
  };
}
