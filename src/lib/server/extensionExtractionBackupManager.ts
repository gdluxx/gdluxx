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

// Internal type tree — mirrors extensionProfiles/types.ts extraction types.
// Kept separate per project pattern (see extensionProfileBackupManager.ts).

export type ExtractionMode = 'range' | 'targeted';

export interface RangeExtractionConfig {
  mode: 'range';
  startSelector: string;
  endSelector: string;
}

export type ContainerSource =
  | { via: 'selector'; selector: string }
  | { via: 'string'; begin: string; end: string }
  | { via: 'body' };

export type ImageSource =
  | { via: 'selector'; selector: string; attr: string }
  | { via: 'string'; begin: string; end: string };

export interface TargetedExtractionConfig {
  mode: 'targeted';
  container: ContainerSource;
  images: ImageSource;
}

export type ExtractionConfig = RangeExtractionConfig | TargetedExtractionConfig;

export interface GalleryDisplayConfig {
  thumbSizes: [number, number, number];
  gap: number;
  border: number;
  buttonCorner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface ExtractionSubRule {
  id: string;
  pattern: string;
  replacement: string;
  flags: string;
  enabled: boolean;
  order: number;
}

export interface SavedExtractionProfile {
  id: string;
  name?: string;
  scope: 'host' | 'origin' | 'path';
  host: string;
  origin?: string;
  path?: string;
  extraction: ExtractionConfig;
  rules: ExtractionSubRule[];
  applyToPreview: boolean;
  autoApply: boolean;
  gallery?: GalleryDisplayConfig;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface ExtractionBundle {
  version: 1;
  profiles: Record<string, SavedExtractionProfile>;
}

interface ExtractionBackupRow {
  api_key_id: string;
  bundle_json: string;
  profile_count: number;
  synced_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface ExtractionBackup {
  apiKeyId: string;
  bundle: ExtractionBundle;
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
           FROM extension_extraction_backups
           WHERE api_key_id = ?`,
        ),
        upsert: db.prepare(
          `INSERT INTO extension_extraction_backups (api_key_id, bundle_json, profile_count, synced_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(api_key_id) DO UPDATE SET
             bundle_json = excluded.bundle_json,
             profile_count = excluded.profile_count,
             synced_by = excluded.synced_by,
             updated_at = excluded.updated_at`,
        ),
        delete: db.prepare('DELETE FROM extension_extraction_backups WHERE api_key_id = ?'),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to prepare extension extraction backup statements', error);
      throw error;
    }
  }

  return statements;
}

const emptyBundle = (): ExtractionBundle => ({ version: 1, profiles: {} });

function parseBundle(row: ExtractionBackupRow): ExtractionBundle {
  try {
    const parsed = JSON.parse(row.bundle_json);
    if (parsed && typeof parsed === 'object' && 'profiles' in parsed) {
      return parsed as ExtractionBundle;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse extraction profile backup payload', error);
  }
  return emptyBundle();
}

function mapRow(row: ExtractionBackupRow | undefined): ExtractionBackup | null {
  if (!row) {
    return null;
  }
  return {
    apiKeyId: row.api_key_id,
    bundle: parseBundle(row),
    profileCount: row.profile_count,
    syncedBy: row.synced_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function countProfiles(bundle: ExtractionBundle): number {
  if (!bundle || typeof bundle !== 'object') {
    return 0;
  }
  const profiles = bundle.profiles;
  if (!profiles || typeof profiles !== 'object') {
    return 0;
  }
  return Object.keys(profiles).length;
}

export function getExtractionBackup(apiKeyId: string): ExtractionBackup | null {
  try {
    const row = getStatements().select.get(apiKeyId) as ExtractionBackupRow | undefined;
    return mapRow(row);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch extraction profile backup', { apiKeyId, error });
    return null;
  }
}

export function saveExtractionBackup(
  apiKeyId: string,
  bundle: ExtractionBundle,
  syncedBy?: string | null,
): ExtractionBackup | null {
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
    return getExtractionBackup(apiKeyId);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist extraction profile backup', { apiKeyId, error });
    return null;
  }
}

export function deleteExtractionBackup(apiKeyId: string): boolean {
  try {
    const result = getStatements().delete.run(apiKeyId);
    return result.changes > 0;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to delete extraction profile backup', { apiKeyId, error });
    return false;
  }
}
