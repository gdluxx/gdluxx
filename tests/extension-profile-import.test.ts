/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
// Type-only imports erased at runtime, so they do not defeat the mocks below
import type * as CoordinatorModuleShape from '../src/lib/server/extensionProfileImport';
import type * as ExtractionManagerShape from '../src/lib/server/extensionExtractionBackupManager';
import type * as SubManagerShape from '../src/lib/server/extensionSubBackupManager';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const database = new Database(':memory:');

  database.exec(`
    CREATE TABLE apiKey (
      id TEXT PRIMARY KEY
    );

    CREATE TABLE extension_profile_backups (
      api_key_id TEXT PRIMARY KEY,
      bundle_json TEXT NOT NULL,
      profile_count INTEGER NOT NULL DEFAULT 0,
      synced_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE extension_sub_backups (
      api_key_id TEXT PRIMARY KEY,
      bundle_json TEXT NOT NULL,
      profile_count INTEGER NOT NULL DEFAULT 0,
      synced_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE extension_extraction_backups (
      api_key_id TEXT PRIMARY KEY REFERENCES apiKey(id) ON DELETE CASCADE,
      bundle_json TEXT NOT NULL,
      profile_count INTEGER NOT NULL DEFAULT 0,
      synced_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return { db: database };
});

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => db,
  getSharedDatabase: () => db,
}));

const EXTRACTION_MANAGER = '$lib/server/extensionExtractionBackupManager';
const SUB_MANAGER = '$lib/server/extensionSubBackupManager';

type CoordinatorModule = typeof CoordinatorModuleShape;

async function loadCoordinator(): Promise<CoordinatorModule> {
  vi.resetModules();
  return import('$lib/server/extensionProfileImport');
}

/* fixtures */

const KIND = 'gdluxx.extension-profiles.bundle';

function selectorProfile(id: string, host = 'example.com') {
  return {
    id,
    scope: 'host' as const,
    host,
    startSelector: `#${id}-start`,
    endSelector: `#${id}-end`,
    createdAt: 1,
    updatedAt: 1,
  };
}

function subProfile(id: string, host = 'example.com') {
  return {
    id,
    scope: 'host' as const,
    host,
    rules: [
      {
        id: `${id}-rule`,
        pattern: 'thumb',
        replacement: 'full',
        flags: 'g',
        enabled: true,
        order: 0,
      },
    ],
    applyToPreview: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

function extractionProfile(id: string, host = 'example.com') {
  return {
    id,
    scope: 'host' as const,
    host,
    extraction: {
      mode: 'range' as const,
      startSelector: `#${id}-start`,
      endSelector: `#${id}-end`,
    },
    rules: [],
    applyToPreview: false,
    autoApply: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

function toProfileMap<T extends { id: string }>(profiles: T[]): Record<string, T> {
  return Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
}

function combined(parts: {
  selectors?: Array<ReturnType<typeof selectorProfile>>;
  subs?: Array<ReturnType<typeof subProfile>>;
  extraction?: Array<ReturnType<typeof extractionProfile>>;
}) {
  return {
    kind: KIND,
    version: 1,
    selectors: { version: 1, profiles: toProfileMap(parts.selectors ?? []) },
    subs: { version: 1, profiles: toProfileMap(parts.subs ?? []) },
    extraction: { version: 1, profiles: toProfileMap(parts.extraction ?? []) },
  } as Parameters<CoordinatorModule['importExtensionProfileBundles']>[1];
}

/* seeding / reading raw rows */

const SEED_TS = 1000;

type BackupTable =
  | 'extension_profile_backups'
  | 'extension_sub_backups'
  | 'extension_extraction_backups';

function seedRow(table: BackupTable, apiKeyId: string, profiles: Record<string, unknown>): void {
  db.prepare(
    `INSERT INTO ${table} (api_key_id, bundle_json, profile_count, synced_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    apiKeyId,
    JSON.stringify({ version: 1, profiles }),
    Object.keys(profiles).length,
    'seed',
    SEED_TS,
    SEED_TS,
  );
}

interface RawRow {
  api_key_id: string;
  bundle_json: string;
  profile_count: number;
  synced_by: string | null;
  created_at: number;
  updated_at: number;
}

function readRow(table: BackupTable, apiKeyId: string): RawRow | undefined {
  return db.prepare(`SELECT * FROM ${table} WHERE api_key_id = ?`).get(apiKeyId) as
    | RawRow
    | undefined;
}

function countRows(table: BackupTable): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

function snapshot(
  table: BackupTable,
  apiKeyId: string,
): { bundle_json: string; updated_at: number } {
  const row = readRow(table, apiKeyId);
  expect(row).toBeDefined();
  return { bundle_json: row!.bundle_json, updated_at: row!.updated_at };
}

afterEach(() => {
  // Every case must leave the connection with no open transaction.
  expect(db.inTransaction).toBe(false);

  vi.doUnmock(EXTRACTION_MANAGER);
  vi.doUnmock(SUB_MANAGER);
  vi.resetModules();

  db.exec(`
    DELETE FROM extension_extraction_backups;
    DELETE FROM extension_sub_backups;
    DELETE FROM extension_profile_backups;
    DELETE FROM apiKey;
  `);
});

describe('extension profile import (transactional)', () => {
  test('foreign key enforcement is on, so the extraction FK is a real constraint', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  test('happy path merges all three bundles and reports added/updated/total', async () => {
    db.prepare('INSERT INTO apiKey (id) VALUES (?)').run('key-1');
    seedRow('extension_profile_backups', 'key-1', toProfileMap([selectorProfile('sel-1')]));
    seedRow('extension_sub_backups', 'key-1', toProfileMap([subProfile('sub-1')]));
    seedRow('extension_extraction_backups', 'key-1', toProfileMap([extractionProfile('ext-1')]));

    const { importExtensionProfileBundles } = await loadCoordinator();

    const outcome = importExtensionProfileBundles(
      'key-1',
      combined({
        selectors: [selectorProfile('sel-1'), selectorProfile('sel-2')],
        subs: [subProfile('sub-2')],
        extraction: [extractionProfile('ext-1'), extractionProfile('ext-2')],
      }),
      'tester@example.test',
    );

    expect(outcome).toEqual({
      ok: true,
      selectors: { added: 1, updated: 1, total: 2 },
      subs: { added: 1, updated: 0, total: 2 },
      extraction: { added: 1, updated: 1, total: 2 },
    });

    const selectorRow = readRow('extension_profile_backups', 'key-1')!;
    const subRow = readRow('extension_sub_backups', 'key-1')!;
    const extractionRow = readRow('extension_extraction_backups', 'key-1')!;

    expect(Object.keys(JSON.parse(selectorRow.bundle_json).profiles).sort()).toEqual([
      'sel-1',
      'sel-2',
    ]);
    expect(Object.keys(JSON.parse(subRow.bundle_json).profiles).sort()).toEqual(['sub-1', 'sub-2']);
    expect(Object.keys(JSON.parse(extractionRow.bundle_json).profiles).sort()).toEqual([
      'ext-1',
      'ext-2',
    ]);

    expect(selectorRow.profile_count).toBe(2);
    expect(subRow.profile_count).toBe(2);
    expect(extractionRow.profile_count).toBe(2);

    for (const row of [selectorRow, subRow, extractionRow]) {
      expect(row.synced_by).toBe('tester@example.test');
      expect(row.created_at).toBe(SEED_TS); // upsert preserves created_at
      expect(row.updated_at).toBeGreaterThan(SEED_TS);
    }
  });

  test('real FK failure on the extraction write rolls back the selector and sub writes', async () => {
    seedRow('extension_profile_backups', 'orphan-key', toProfileMap([selectorProfile('sel-1')]));
    seedRow('extension_sub_backups', 'orphan-key', toProfileMap([subProfile('sub-1')]));

    const before = {
      selectors: snapshot('extension_profile_backups', 'orphan-key'),
      subs: snapshot('extension_sub_backups', 'orphan-key'),
    };

    const { importExtensionProfileBundles } = await loadCoordinator();

    const outcome = importExtensionProfileBundles(
      'orphan-key',
      combined({
        selectors: [selectorProfile('sel-2')],
        subs: [subProfile('sub-2')],
        extraction: [extractionProfile('ext-1')],
      }),
      'tester@example.test',
    );

    expect(outcome).toEqual({ ok: false, reason: 'save', stage: 'extraction' });

    expect(snapshot('extension_profile_backups', 'orphan-key')).toEqual(before.selectors);
    expect(snapshot('extension_sub_backups', 'orphan-key')).toEqual(before.subs);
    expect(countRows('extension_extraction_backups')).toBe(0);
  });

  test('a null return from saveExtractionBackup rolls back deterministically', async () => {
    db.prepare('INSERT INTO apiKey (id) VALUES (?)').run('key-1');
    seedRow('extension_profile_backups', 'key-1', toProfileMap([selectorProfile('sel-1')]));
    seedRow('extension_sub_backups', 'key-1', toProfileMap([subProfile('sub-1')]));

    const before = {
      selectors: snapshot('extension_profile_backups', 'key-1'),
      subs: snapshot('extension_sub_backups', 'key-1'),
    };

    vi.resetModules();
    vi.doMock(EXTRACTION_MANAGER, async () => {
      const actual = await vi.importActual<typeof ExtractionManagerShape>(EXTRACTION_MANAGER);
      return { ...actual, saveExtractionBackup: () => null };
    });

    const { importExtensionProfileBundles } = await import('$lib/server/extensionProfileImport');

    const outcome = importExtensionProfileBundles(
      'key-1',
      combined({
        selectors: [selectorProfile('sel-2')],
        subs: [subProfile('sub-2')],
        extraction: [extractionProfile('ext-1')],
      }),
      'tester@example.test',
    );

    expect(outcome).toEqual({ ok: false, reason: 'save', stage: 'extraction' });
    expect(snapshot('extension_profile_backups', 'key-1')).toEqual(before.selectors);
    expect(snapshot('extension_sub_backups', 'key-1')).toEqual(before.subs);
    expect(countRows('extension_extraction_backups')).toBe(0);
  });

  test('a failure mid-ladder (subs) leaves the already-written selector bundle untouched', async () => {
    db.prepare('INSERT INTO apiKey (id) VALUES (?)').run('key-1');
    seedRow('extension_profile_backups', 'key-1', toProfileMap([selectorProfile('sel-1')]));

    const before = snapshot('extension_profile_backups', 'key-1');

    vi.resetModules();
    vi.doMock(SUB_MANAGER, async () => {
      const actual = await vi.importActual<typeof SubManagerShape>(SUB_MANAGER);
      return { ...actual, saveSubBackup: () => null };
    });

    const { importExtensionProfileBundles } = await import('$lib/server/extensionProfileImport');

    const outcome = importExtensionProfileBundles(
      'key-1',
      combined({
        selectors: [selectorProfile('sel-2')],
        subs: [subProfile('sub-1')],
        extraction: [extractionProfile('ext-1')],
      }),
      'tester@example.test',
    );

    expect(outcome).toEqual({ ok: false, reason: 'save', stage: 'subs' });
    expect(snapshot('extension_profile_backups', 'key-1')).toEqual(before);
    expect(countRows('extension_sub_backups')).toBe(0);
    expect(countRows('extension_extraction_backups')).toBe(0);
  });

  test('merged-bundle validation failure is reported before any write', async () => {
    db.prepare('INSERT INTO apiKey (id) VALUES (?)').run('key-1');

    const existing = Array.from({ length: 40 }, (_, i) =>
      selectorProfile(`stored-${i}`, 'cap.example'),
    );
    seedRow('extension_profile_backups', 'key-1', toProfileMap(existing));
    seedRow('extension_sub_backups', 'key-1', toProfileMap([subProfile('sub-1')]));
    seedRow('extension_extraction_backups', 'key-1', toProfileMap([extractionProfile('ext-1')]));

    const before = {
      selectors: snapshot('extension_profile_backups', 'key-1'),
      subs: snapshot('extension_sub_backups', 'key-1'),
      extraction: snapshot('extension_extraction_backups', 'key-1'),
    };

    const { importExtensionProfileBundles } = await loadCoordinator();

    const outcome = importExtensionProfileBundles(
      'key-1',
      combined({
        selectors: Array.from({ length: 15 }, (_, i) => selectorProfile(`new-${i}`, 'cap.example')),
        subs: [subProfile('sub-2')],
        extraction: [extractionProfile('ext-2')],
      }),
      'tester@example.test',
    );

    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ reason: 'validation' });
    expect(outcome.ok === false && outcome.reason === 'validation' && outcome.message).toContain(
      'max allowed is 50',
    );

    expect(snapshot('extension_profile_backups', 'key-1')).toEqual(before.selectors);
    expect(snapshot('extension_sub_backups', 'key-1')).toEqual(before.subs);
    expect(snapshot('extension_extraction_backups', 'key-1')).toEqual(before.extraction);
  });
});
