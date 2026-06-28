import Database from 'better-sqlite3';
import { afterEach, describe, expect, test } from 'vitest';
import { migrateApiKeyTable } from '../src/lib/server/auth/apiKeyTableMigration';

let db: Database.Database | null = null;

function openTestDatabase(): Database.Database {
  db = new Database(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    INSERT INTO user (id, email, createdAt, updatedAt)
    VALUES ('user-1', 'admin@example.test', 1000, 1000);
  `);
  return db;
}

function tableInfo(database: Database.Database) {
  return database.pragma('table_info(apiKey)') as Array<{
    name: string;
    notnull: number;
  }>;
}

function indexNames(database: Database.Database): string[] {
  return (
    database.pragma('index_list(apiKey)') as Array<{
      name: string;
    }>
  ).map((index) => index.name);
}

afterEach(() => {
  db?.close();
  db = null;
});

describe('apiKey table migration', () => {
  test('creates the canonical table when apiKey is missing', () => {
    const database = openTestDatabase();

    migrateApiKeyTable(database);

    const columns = tableInfo(database);
    expect(columns.some((column) => column.name === 'userId')).toBe(false);
    expect(columns.find((column) => column.name === 'referenceId')?.notnull).toBe(1);
    expect(columns.find((column) => column.name === 'configId')?.notnull).toBe(1);
    expect(indexNames(database)).toEqual(
      expect.arrayContaining(['idx_apiKey_configId', 'idx_apiKey_referenceId', 'idx_apiKey_key']),
    );
  });

  test('rebuilds a legacy userId table and preserves API key rows', () => {
    const database = openTestDatabase();
    database.exec(`
      CREATE TABLE apiKey (
        id TEXT PRIMARY KEY,
        name TEXT,
        start TEXT,
        prefix TEXT,
        key TEXT NOT NULL,
        userId TEXT NOT NULL,
        refillInterval INTEGER,
        refillAmount INTEGER,
        lastRefillAt INTEGER,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        rateLimitEnabled BOOLEAN NOT NULL DEFAULT 0,
        rateLimitTimeWindow INTEGER,
        rateLimitMax INTEGER,
        requestCount INTEGER NOT NULL DEFAULT 0,
        remaining INTEGER,
        lastRequest INTEGER,
        expiresAt INTEGER,
        createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        permissions TEXT,
        metadata TEXT,
        referenceId TEXT,
        configId TEXT NOT NULL DEFAULT 'default'
      );

      INSERT INTO apiKey (
        id, name, start, prefix, key, userId, enabled, rateLimitEnabled,
        requestCount, expiresAt, createdAt, updatedAt, permissions, metadata
      )
      VALUES (
        'key-1', 'Extension key', 'sk_abc', 'sk_', 'hashed-key', 'user-1', 1, 0,
        3, 2000, 1000, 1500, '{"download":["create"]}', '{"source":"test"}'
      );
    `);

    migrateApiKeyTable(database);

    const columns = tableInfo(database);
    expect(columns.some((column) => column.name === 'userId')).toBe(false);
    expect(columns.find((column) => column.name === 'referenceId')?.notnull).toBe(1);

    const row = database.prepare('SELECT * FROM apiKey WHERE id = ?').get('key-1') as {
      id: string;
      key: string;
      referenceId: string;
      configId: string;
      requestCount: number;
      permissions: string;
      metadata: string;
    };
    expect(row).toMatchObject({
      id: 'key-1',
      key: 'hashed-key',
      referenceId: 'user-1',
      configId: 'default',
      requestCount: 3,
      permissions: '{"download":["create"]}',
      metadata: '{"source":"test"}',
    });
  });

  test('keeps extension backup references valid when rebuilding', () => {
    const database = openTestDatabase();
    database.exec(`
      CREATE TABLE apiKey (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        userId TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        rateLimitEnabled BOOLEAN NOT NULL DEFAULT 0,
        requestCount INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE extension_extraction_backups (
        api_key_id TEXT PRIMARY KEY REFERENCES apiKey(id) ON DELETE CASCADE,
        bundle_json TEXT NOT NULL,
        profile_count INTEGER NOT NULL DEFAULT 0,
        synced_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO apiKey (id, key, userId, createdAt, updatedAt)
      VALUES ('key-1', 'hashed-key', 'user-1', 1000, 1000);

      INSERT INTO extension_extraction_backups (
        api_key_id, bundle_json, profile_count, synced_by, created_at, updated_at
      )
      VALUES ('key-1', '{"profiles":[]}', 0, 'tester', 1000, 1000);
    `);

    migrateApiKeyTable(database);

    const foreignKeyErrors = database.pragma('foreign_key_check') as unknown[];
    const backup = database
      .prepare('SELECT api_key_id, bundle_json FROM extension_extraction_backups')
      .get() as { api_key_id: string; bundle_json: string };

    expect(foreignKeyErrors).toEqual([]);
    expect(backup).toEqual({ api_key_id: 'key-1', bundle_json: '{"profiles":[]}' });
  });

  test('is idempotent for an already canonical table', () => {
    const database = openTestDatabase();

    migrateApiKeyTable(database);
    database
      .prepare(
        `INSERT INTO apiKey (id, configId, key, referenceId, enabled, rateLimitEnabled, requestCount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('key-1', 'default', 'hashed-key', 'user-1', 1, 0, 0);

    migrateApiKeyTable(database);

    const rows = database.prepare('SELECT id, referenceId FROM apiKey').all();
    expect(rows).toEqual([{ id: 'key-1', referenceId: 'user-1' }]);
  });

  test('allows Better Auth style inserts without legacy userId after migration', () => {
    const database = openTestDatabase();
    database.exec(`
      CREATE TABLE apiKey (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        userId TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        rateLimitEnabled BOOLEAN NOT NULL DEFAULT 0,
        requestCount INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    migrateApiKeyTable(database);

    expect(() => {
      database
        .prepare(
          `INSERT INTO apiKey (
            id, configId, key, referenceId, enabled, rateLimitEnabled, requestCount
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('key-2', 'default', 'new-hashed-key', 'user-1', 1, 0, 0);
    }).not.toThrow();
  });

  test('fails instead of dropping API keys with unresolved ownership', () => {
    const database = openTestDatabase();
    database.exec(`
      CREATE TABLE apiKey (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        referenceId TEXT,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        rateLimitEnabled BOOLEAN NOT NULL DEFAULT 0,
        requestCount INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      INSERT INTO apiKey (id, key, referenceId, createdAt, updatedAt)
      VALUES ('key-1', 'hashed-key', NULL, 1000, 1000);
    `);

    expect(() => migrateApiKeyTable(database)).toThrow(
      'Cannot migrate apiKey table: 1 row(s) have no referenceId or userId value.',
    );
    expect(database.prepare('SELECT COUNT(*) AS count FROM apiKey').get()).toEqual({ count: 1 });
  });
});
