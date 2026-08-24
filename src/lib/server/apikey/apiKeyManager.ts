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
import { serverLogger as logger } from '$lib/server/logger';
import { deleteProfileBackup } from '$lib/server/extensionProfileBackupManager';
import { deleteSubBackup } from '$lib/server/extensionSubBackupManager';
import { getCookieBackup } from '$lib/server/cookieBackupManager';
import { removeCachedCookieFile } from '$lib/server/cookieFileManager';
import { API_KEY_STATEMENTS } from './permissions';
import type { ApiKey } from '$lib/apikey/types';
import type BetterSqlite3 from 'better-sqlite3';
import type { RunResult, Statement } from 'better-sqlite3';

export const API_KEY_DEFAULT_EXPIRY_SECONDS = 365 * 24 * 60 * 60;

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

// The plugin's keyExpiration.defaultExpiresIn was removed from better-auth.ts, so
// a direct auth.api.createApiKey call omitting expiresIn now creates a
// never-expiring key. All key creation must go through this manager, which
// supplies the 365-day default itself (expiresAt: undefined) and only
// produces a never-expiring key on an explicit expiresAt: null.
export async function createApiKey(
  name: string,
  userId: string,
  expiresAt?: Date | null,
): Promise<{
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  expiresAt?: number;
  key: string;
}> {
  try {
    const expiresIn =
      expiresAt instanceof Date
        ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
        : expiresAt === null
          ? undefined
          : API_KEY_DEFAULT_EXPIRY_SECONDS;

    const result = await auth.api.createApiKey({
      body: {
        name,
        userId,
        prefix: 'sk_',
        expiresIn,
        // Manager-created keys must receive this grant independently of the
        // plugin's default-permissions configuration.
        permissions: API_KEY_STATEMENTS,
      },
    });

    logger.info(`Created API key: ${name} (${result.id})`);

    return {
      id: result.id,
      name: result.name || name,
      userId: result.referenceId,
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

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    const stmt = db.prepare(`
			SELECT id, name, referenceId AS userId, createdAt, expiresAt, lastRequest
			FROM apiKey
			WHERE referenceId = ?
			ORDER BY createdAt DESC
	`);
    const rows = stmt.all(userId) as ApiKeyRow[];

    return rows.map((row: ApiKeyRow) => ({
      id: row.id,
      name: row.name || 'Unnamed Key',
      userId: row.userId,
      createdAt: new Date(row.createdAt).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      lastUsedAt: row.lastRequest ? new Date(row.lastRequest).toISOString() : null,
    }));
  } catch (error) {
    logger.error('Error listing API keys:', error);
    return [];
  }
}

export async function deleteApiKey(keyId: string, userId: string): Promise<void> {
  try {
    // cookie backup row is FK-cascaded with the apiKey row; capture its
    // domains first so the cached files can still be cleaned up afterward
    const cookieBackup = getCookieBackup(keyId);

    // better-auth delete not working as expected, revisit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    // Scoped by referenceId so one user can never delete another's key; the
    // same generic error covers "not found" and "not yours" (no ownership
    // disclosure).
    const stmt: Statement = db.prepare('DELETE FROM apiKey WHERE id = ? AND referenceId = ?');
    const result: RunResult = stmt.run(keyId, userId);

    if (result.changes === 0) {
      throw new Error('API key not found');
    }

    deleteProfileBackup(keyId);
    deleteSubBackup(keyId);

    if (cookieBackup) {
      for (const domain of Object.keys(cookieBackup.bundle.domains ?? {})) {
        await removeCachedCookieFile(domain);
      }
    }

    logger.info(`Deleted API key: ${keyId}`);
  } catch (error) {
    logger.error('Error deleting API key:', error);
    throw error;
  }
}

export async function findApiKeyByName(name: string, userId: string): Promise<ApiKey | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (auth as any).options.database as BetterSqlite3.Database;
    const stmt: Statement = db.prepare(`
			SELECT id, name, referenceId AS userId, createdAt, expiresAt, lastRequest
			FROM apiKey
			WHERE referenceId = ? AND name = ?
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
      lastUsedAt: row.lastRequest ? new Date(row.lastRequest).toISOString() : null,
    };
  } catch (error) {
    logger.error('Error finding API key by name:', error);
    return null;
  }
}
