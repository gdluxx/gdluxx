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

// Must match the jobs table in schema.sql, column order included
const JOBS_TABLE_SQL = `
  CREATE TABLE jobs_new (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'running', 'success', 'no_action', 'error')),
    startTime INTEGER NOT NULL,
    endTime INTEGER,
    exitCode INTEGER,
    downloadCount INTEGER DEFAULT 0,
    skipCount INTEGER DEFAULT 0,
    batchCount INTEGER DEFAULT NULL,
    useUserConfigPath INTEGER NOT NULL DEFAULT 0,
    queuePayload TEXT DEFAULT NULL,
    retryOfJobId TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`;

const CANONICAL_COLUMNS = [
  'id',
  'url',
  'status',
  'startTime',
  'endTime',
  'exitCode',
  'downloadCount',
  'skipCount',
  'batchCount',
  'useUserConfigPath',
  'queuePayload',
  'retryOfJobId',
  'createdAt',
  'updatedAt',
] as const;

const MISSING_COLUMN_FALLBACKS: Partial<Record<(typeof CANONICAL_COLUMNS)[number], string>> = {
  downloadCount: '0',
  skipCount: '0',
  useUserConfigPath: '0',
};

function hasColumn(columns: TableColumn[], name: string): boolean {
  return columns.some((column) => column.name === name);
}

function needsJobsTableRebuild(db: BetterSqlite3.Database, columns: TableColumn[]): boolean {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
    .get() as { sql: string } | undefined;

  return (
    !table?.sql.includes("'waiting'") ||
    !hasColumn(columns, 'queuePayload') ||
    !hasColumn(columns, 'retryOfJobId')
  );
}

function countJobsViolations(db: BetterSqlite3.Database): number {
  return (db.pragma('foreign_key_check') as ForeignKeyCheckRow[]).filter(
    (row) => row.table === 'jobs' || row.parent === 'jobs',
  ).length;
}

function rebuildJobsTable(db: BetterSqlite3.Database, columns: TableColumn[]): void {
  const previousForeignKeys = (
    db.pragma('foreign_keys', { simple: false }) as ForeignKeySetting[]
  )[0]?.foreign_keys;

  // Must be OFF, and set outside the transaction: with enforcement on,
  // DROP TABLE jobs cascades into job_outputs and schedule_run_jobs.
  db.pragma('foreign_keys = OFF');
  let existingViolations = 0;
  try {
    db.transaction(() => {
      existingViolations = countJobsViolations(db);
      db.exec('DROP TABLE IF EXISTS jobs_new');
      db.exec(JOBS_TABLE_SQL);

      const selectColumns = CANONICAL_COLUMNS.map((column) =>
        hasColumn(columns, column) ? column : (MISSING_COLUMN_FALLBACKS[column] ?? 'NULL'),
      ).join(', ');
      db.exec(
        `INSERT INTO jobs_new (${CANONICAL_COLUMNS.join(', ')}) SELECT ${selectColumns} FROM jobs`,
      );

      db.exec('DROP TABLE jobs');
      db.exec('ALTER TABLE jobs_new RENAME TO jobs');

      const addedViolations = countJobsViolations(db) - existingViolations;
      if (addedViolations > 0) {
        throw new Error(
          `jobs table migration would add ${addedViolations} foreign key violation(s); rolled back.`,
        );
      }
    })();
  } finally {
    if (previousForeignKeys === 1) {
      db.pragma('foreign_keys = ON');
    }
  }

  if (existingViolations > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `jobs table migration found ${existingViolations} existing foreign key violation(s); left as is.`,
    );
  }
}

/**
 * Runs before schema.sql is applied. schema.sql indexes columns this adds.
 * Indexes on the old table are dropped with it, schema.sql recreates them.
 */
export function migrateJobsTable(db: BetterSqlite3.Database): void {
  const columns = db.pragma('table_info(jobs)') as TableColumn[];
  if (columns.length === 0) {
    return;
  }

  if (needsJobsTableRebuild(db, columns)) {
    // eslint-disable-next-line no-console
    console.log('Migrating jobs table for the job queue...');
    rebuildJobsTable(db, columns);
  }
}
