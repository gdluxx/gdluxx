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
import type { ApiKey } from '$lib/types/apiKey';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

function getCurrentTimestamp(): number {
  return Date.now();
}

export async function readApiKeys(): Promise<ApiKey[]> {
  try {
    const stmt = db.prepare(
      'SELECT id, name, hashedKey, createdAt FROM api_keys ORDER BY createdAt DESC'
    );
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      hashedKey: string;
      createdAt: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      hashedKey: row.hashedKey,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading API keys from database:', error);
    return [];
  }
}

export async function createApiKey(apiKey: ApiKey): Promise<void> {
  try {
    const now = getCurrentTimestamp();
    const createdAt = new Date(apiKey.createdAt).getTime();

    const stmt = db.prepare(`
      INSERT INTO api_keys (id, name, hashedKey, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(apiKey.id, apiKey.name, apiKey.hashedKey, createdAt, now);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating API key in database:', error);
    throw new Error('Failed to create API key.');
  }
}

export async function deleteApiKey(keyId: string): Promise<ApiKey | null> {
  try {
    // First, get the key before deleting it
    const selectStmt = db.prepare(
      'SELECT id, name, hashedKey, createdAt FROM api_keys WHERE id = ?'
    );
    const row = selectStmt.get(keyId) as
      | {
          id: string;
          name: string;
          hashedKey: string;
          createdAt: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    // Delete the key
    const deleteStmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
    deleteStmt.run(keyId);

    return {
      id: row.id,
      name: row.name,
      hashedKey: row.hashedKey,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting API key from database:', error);
    throw new Error('Failed to delete API key.');
  }
}

export async function findApiKeyByName(name: string): Promise<ApiKey | null> {
  try {
    const stmt = db.prepare('SELECT id, name, hashedKey, createdAt FROM api_keys WHERE name = ?');
    const row = stmt.get(name) as
      | {
          id: string;
          name: string;
          hashedKey: string;
          createdAt: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      hashedKey: row.hashedKey,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error finding API key by name in database:', error);
    return null;
  }
}
