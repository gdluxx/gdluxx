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
import type { Statement } from 'better-sqlite3';
import { PATHS } from '$lib/server/constants';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

export function getCurrentTimestamp(): number {
  return Date.now();
}

export type ProfileScope = 'host' | 'origin' | 'path';

export interface SavedSelectorProfile {
  id: string;
  scope: ProfileScope;
  host: string;
  path?: string;
  origin?: string;
  startSelector: string;
  endSelector: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface SelectorProfileBundle {
  version: number;
  profiles: Record<string, SavedSelectorProfile>;
}

interface ProfileBackupRow {
  api_key_id: string;
  bundle_json: string;
  profile_count: number;
  synced_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface SelectorProfileBackup {
  apiKeyId: string;
  bundle: SelectorProfileBundle;
  profileCount: number;
  syncedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

interface PreparedStatements {
  select: Statement<[string]>;
  upsert: Statement<[string, string, number, string | null, number, number]>;
  delete: Statement<[string]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    try {
      statements = {
        select: db.prepare(
          `SELECT api_key_id, bundle_json, profile_count, synced_by, created_at, updated_at
           FROM extension_profile_backups
           WHERE api_key_id = ?`,
        ),
        upsert: db.prepare(
          `INSERT INTO extension_profile_backups (api_key_id, bundle_json, profile_count, synced_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(api_key_id) DO UPDATE SET
             bundle_json = excluded.bundle_json,
             profile_count = excluded.profile_count,
             synced_by = excluded.synced_by,
             updated_at = excluded.updated_at`,
        ),
        delete: db.prepare('DELETE FROM extension_profile_backups WHERE api_key_id = ?'),
      };
    } catch (error) {
      console.error('Failed to prepare extension profile backup statements', error);
      throw error;
    }
  }

  return statements;
}

const emptyBundle = (): SelectorProfileBundle => ({ version: 1, profiles: {} });

function parseBundle(row: ProfileBackupRow): SelectorProfileBundle {
  try {
    const parsed = JSON.parse(row.bundle_json);
    if (parsed && typeof parsed === 'object' && 'profiles' in parsed) {
      return parsed as SelectorProfileBundle;
    }
  } catch (error) {
    console.error('Failed to parse selector profile backup payload', error);
  }
  return emptyBundle();
}

function mapRow(row: ProfileBackupRow | undefined): SelectorProfileBackup | null {
  if (!row) return null;
  return {
    apiKeyId: row.api_key_id,
    bundle: parseBundle(row),
    profileCount: row.profile_count,
    syncedBy: row.synced_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function countProfiles(bundle: SelectorProfileBundle): number {
  if (!bundle || typeof bundle !== 'object') return 0;
  const profiles = bundle.profiles;
  if (!profiles || typeof profiles !== 'object') return 0;
  return Object.keys(profiles).length;
}

export function getProfileBackup(apiKeyId: string): SelectorProfileBackup | null {
  try {
    const row = getStatements().select.get(apiKeyId) as ProfileBackupRow | undefined;
    return mapRow(row);
  } catch (error) {
    console.error('Failed to fetch selector profile backup', { apiKeyId, error });
    return null;
  }
}

export function saveProfileBackup(
  apiKeyId: string,
  bundle: SelectorProfileBundle,
  syncedBy?: string | null,
): SelectorProfileBackup | null {
  const now = getCurrentTimestamp();
  const normalizedBundle = bundle ?? emptyBundle();
  const payload = {
    apiKeyId,
    bundleJson: JSON.stringify(normalizedBundle),
    profileCount: countProfiles(normalizedBundle),
    syncedBy: syncedBy ?? null,
  };

  try {
    getStatements().upsert.run(
      payload.apiKeyId,
      payload.bundleJson,
      payload.profileCount,
      payload.syncedBy,
      now,
      now,
    );
    return getProfileBackup(apiKeyId);
  } catch (error) {
    console.error('Failed to persist selector profile backup', { apiKeyId, error });
    return null;
  }
}

export function deleteProfileBackup(apiKeyId: string): boolean {
  try {
    const result = getStatements().delete.run(apiKeyId);
    return result.changes > 0;
  } catch (error) {
    console.error('Failed to delete selector profile backup', { apiKeyId, error });
    return false;
  }
}
