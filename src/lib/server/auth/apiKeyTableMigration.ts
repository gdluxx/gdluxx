/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type BetterSqlite3 from 'better-sqlite3';

interface TableColumn {
  name: string;
  notnull: number;
}

interface ForeignKeySetting {
  foreign_keys: number;
}

interface ForeignKeyCheckRow {
  table: string;
  rowid: number;
  parent: string;
  fkid: number;
}

interface CountRow {
  count: number;
}

const API_KEY_TABLE_SQL = `
  CREATE TABLE apiKey (
    id TEXT PRIMARY KEY,
    configId TEXT NOT NULL DEFAULT 'default',
    name TEXT,
    start TEXT,
    prefix TEXT,
    key TEXT NOT NULL,
    referenceId TEXT NOT NULL,
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
    FOREIGN KEY (referenceId) REFERENCES user(id) ON DELETE CASCADE
  )
`;

const CREATE_API_KEY_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_apiKey_configId ON apiKey(configId);
  CREATE INDEX IF NOT EXISTS idx_apiKey_referenceId ON apiKey(referenceId);
  CREATE INDEX IF NOT EXISTS idx_apiKey_key ON apiKey(key);
`;

const CANONICAL_COLUMNS = [
  'id',
  'configId',
  'name',
  'start',
  'prefix',
  'key',
  'referenceId',
  'refillInterval',
  'refillAmount',
  'lastRefillAt',
  'enabled',
  'rateLimitEnabled',
  'rateLimitTimeWindow',
  'rateLimitMax',
  'requestCount',
  'remaining',
  'lastRequest',
  'expiresAt',
  'createdAt',
  'updatedAt',
  'permissions',
  'metadata',
] as const;

function getApiKeyTableInfo(db: BetterSqlite3.Database): TableColumn[] {
  return db.pragma('table_info(apiKey)') as TableColumn[];
}

function hasColumn(columns: TableColumn[], name: string): boolean {
  return columns.some((column) => column.name === name);
}

function getColumn(columns: TableColumn[], name: string): TableColumn | undefined {
  return columns.find((column) => column.name === name);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function coalesceOrSingle(expressions: string[]): string {
  return expressions.length === 1 ? expressions[0] : `COALESCE(${expressions.join(', ')})`;
}

function createApiKeyTable(db: BetterSqlite3.Database): void {
  db.exec(`${API_KEY_TABLE_SQL};${CREATE_API_KEY_INDEXES_SQL}`);
}

function needsApiKeyTableRebuild(columns: TableColumn[]): boolean {
  const referenceId = getColumn(columns, 'referenceId');
  const configId = getColumn(columns, 'configId');

  return hasColumn(columns, 'userId') || referenceId?.notnull !== 1 || configId?.notnull !== 1;
}

function buildSelectExpression(
  columns: TableColumn[],
  column: (typeof CANONICAL_COLUMNS)[number],
): string {
  const quotedColumn = quoteIdentifier(column);
  const hasCurrentColumn = hasColumn(columns, column);

  if (column === 'configId') {
    return hasCurrentColumn ? `COALESCE(${quotedColumn}, 'default')` : "'default'";
  }

  if (column === 'referenceId') {
    const references = [];
    if (hasCurrentColumn) {
      references.push(quotedColumn);
    }
    if (hasColumn(columns, 'userId')) {
      references.push(quoteIdentifier('userId'));
    }
    if (references.length === 0) {
      throw new Error('Cannot migrate apiKey table: no referenceId or userId column exists.');
    }
    return coalesceOrSingle(references);
  }

  if (hasCurrentColumn) {
    return quotedColumn;
  }

  switch (column) {
    case 'enabled':
      return '1';
    case 'rateLimitEnabled':
      return '0';
    case 'requestCount':
      return '0';
    case 'createdAt':
    case 'updatedAt':
      return 'unixepoch() * 1000';
    default:
      return 'NULL';
  }
}

function rebuildApiKeyTable(db: BetterSqlite3.Database, columns: TableColumn[]): void {
  const referenceColumns = [
    hasColumn(columns, 'referenceId') ? quoteIdentifier('referenceId') : null,
    hasColumn(columns, 'userId') ? quoteIdentifier('userId') : null,
  ].filter((column): column is string => Boolean(column));

  if (referenceColumns.length === 0) {
    throw new Error('Cannot migrate apiKey table: no referenceId or userId column exists.');
  }

  const missingReferenceCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM apiKey WHERE ${coalesceOrSingle(referenceColumns)} IS NULL`,
      )
      .get() as CountRow
  ).count;
  if (missingReferenceCount > 0) {
    throw new Error(
      `Cannot migrate apiKey table: ${missingReferenceCount} row(s) have no referenceId or userId value.`,
    );
  }

  const previousForeignKeys = (
    db.pragma('foreign_keys', { simple: false }) as ForeignKeySetting[]
  )[0]?.foreign_keys;
  const shouldRestoreForeignKeys = previousForeignKeys === 1;

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec('DROP TABLE IF EXISTS apiKey_new');
      db.exec(API_KEY_TABLE_SQL.replace('CREATE TABLE apiKey', 'CREATE TABLE apiKey_new'));

      const insertColumns = CANONICAL_COLUMNS.map(quoteIdentifier).join(', ');
      const selectColumns = CANONICAL_COLUMNS.map((column) =>
        buildSelectExpression(columns, column),
      ).join(', ');

      db.exec(`
        INSERT INTO apiKey_new (${insertColumns})
        SELECT ${selectColumns}
        FROM apiKey
      `);

      db.exec('DROP TABLE apiKey');
      db.exec('ALTER TABLE apiKey_new RENAME TO apiKey');
      db.exec(CREATE_API_KEY_INDEXES_SQL);
    })();

    const foreignKeyErrors = db.pragma('foreign_key_check') as ForeignKeyCheckRow[];
    if (foreignKeyErrors.length > 0) {
      throw new Error(
        `apiKey migration completed with ${foreignKeyErrors.length} foreign key violation(s).`,
      );
    }
  } finally {
    db.exec('DROP TABLE IF EXISTS apiKey_new');
    if (shouldRestoreForeignKeys) {
      db.pragma('foreign_keys = ON');
    }
  }
}

export function migrateApiKeyTable(db: BetterSqlite3.Database): void {
  const columns = getApiKeyTableInfo(db);

  if (columns.length === 0) {
    // eslint-disable-next-line no-console
    console.log('Creating API key table for better-auth plugin...');
    createApiKeyTable(db);
    return;
  }

  if (needsApiKeyTableRebuild(columns)) {
    // eslint-disable-next-line no-console
    console.log('Migrating API key table to current better-auth schema...');
    rebuildApiKeyTable(db, columns);
    return;
  }

  db.exec(CREATE_API_KEY_INDEXES_SQL);
}
