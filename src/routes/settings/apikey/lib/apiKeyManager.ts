/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { auth } from '$lib/server/auth/better-auth';
import { logger } from '$lib/shared/logger';
import type { ApiKey } from './types';
import type BetterSqlite3 from 'better-sqlite3';
import type { RunResult, Statement } from 'better-sqlite3';

interface UserRow {
  id: string;
}

interface ApiKeyRow {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  key: string;
  userId: string;
  refillInterval: number | null;
  refillAmount: number | null;
  lastRefillAt: number | null;
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitTimeWindow: number | null;
  rateLimitMax: number | null;
  requestCount: number;
  remaining: number | null;
  lastRequest: number | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
  permissions: string | null;
  metadata: string | null;
}

async function getAdminUserId(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    const stmt: Statement = db.prepare('SELECT id FROM user LIMIT 1');
    const user = stmt.get() as UserRow | undefined;

    if (!user) {
      throw new Error('No admin user found');
    }
    return user.id;
  } catch (error) {
    logger.error('Error getting admin user ID:', error);
    throw error;
  }
}

export async function createApiKey(
  name: string,
  expiresAt?: Date
): Promise<{
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  expiresAt?: number;
  key: string;
}> {
  try {
    const userId: string = await getAdminUserId();
    const result = await auth.api.createApiKey({
      body: {
        name,
        userId,
        prefix: 'sk_', // All the big dogs do it (may help with debugging)
        expiresIn: expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : undefined, // Convert to seconds from now
      },
    });

    logger.info(`Created API key: ${name} (${result.id})`);

    return {
      id: result.id,
      name: result.name || name,
      userId: result.userId,
      createdAt:
        result.createdAt instanceof Date
          ? result.createdAt.getTime()
          : new Date(result.createdAt).getTime(),
      expiresAt: result.expiresAt
        ? result.expiresAt instanceof Date
          ? result.expiresAt.getTime()
          : new Date(result.expiresAt).getTime()
        : undefined,
      key: result.key,
    };
  } catch (error) {
    logger.error('Error creating API key:', error);
    throw error;
  }
}

export async function listApiKeys(): Promise<ApiKey[]> {
  try {
    const userId: string = await getAdminUserId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    const stmt = db.prepare(`
			SELECT id, name, userId, createdAt, expiresAt 
			FROM apiKey 
			WHERE userId = ? 
			ORDER BY createdAt DESC
		`);
    const rows = stmt.all(userId) as ApiKeyRow[];

    return rows.map((row: ApiKeyRow) => ({
      id: row.id,
      name: row.name || 'Unnamed Key',
      userId: row.userId,
      createdAt: new Date(row.createdAt).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    }));
  } catch (error) {
    logger.error('Error listing API keys:', error);
    return [];
  }
}

export async function deleteApiKey(keyId: string): Promise<void> {
  try {
    // better-auth delete not working as expected, revisit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    const stmt: Statement = db.prepare('DELETE FROM apiKey WHERE id = ?');
    const result: RunResult = stmt.run(keyId);

    if (result.changes === 0) {
      throw new Error('API key not found');
    }

    logger.info(`Deleted API key: ${keyId}`);
  } catch (error) {
    logger.error('Error deleting API key:', error);
    throw error;
  }
}

export async function findApiKeyByName(name: string): Promise<ApiKey | null> {
  try {
    const userId: string = await getAdminUserId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    const stmt: Statement = db.prepare(`
			SELECT id, name, userId, createdAt, expiresAt 
			FROM apiKey 
			WHERE userId = ? AND name = ?
		`);
    const row = stmt.get(userId, name) as ApiKeyRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name || 'Unnamed Key',
      userId: row.userId,
      createdAt: new Date(row.createdAt).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    };
  } catch (error) {
    logger.error('Error finding API key by name:', error);
    return null;
  }
}
