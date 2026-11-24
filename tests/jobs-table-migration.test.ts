/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { migrateJobsTable } from '../src/lib/server/jobs/jobsTableMigration';

const SCHEMA_SQL = readFileSync(new URL('../src/lib/server/schema.sql', import.meta.url), 'utf8');

const PRE_QUEUE_JOBS_SQL = `
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'no_action', 'error')),
    startTime INTEGER NOT NULL,
    endTime INTEGER,
    exitCode INTEGER,
    downloadCount INTEGER DEFAULT 0,
    skipCount INTEGER DEFAULT 0,
    batchCount INTEGER DEFAULT NULL,
    useUserConfigPath INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`;

// Shape left behind by the PR's interim migration.
const INTERIM_JOBS_SQL = `
  CREATE TABLE jobs (
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
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`;

const DEPENDENT_TABLES_SQL = `
  CREATE TABLE job_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
  );
  CREATE TABLE schedule_runs (id TEXT PRIMARY KEY);
  CREATE TABLE schedule_run_jobs (
    runId TEXT NOT NULL REFERENCES schedule_runs(id) ON DELETE CASCADE,
    jobId TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    PRIMARY KEY (runId, jobId)
  );
`;

let db: Database.Database | null = null;

function openLegacyDatabase(jobsSql: string): Database.Database {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(jobsSql);
  db.exec(DEPENDENT_TABLES_SQL);
  db.exec(`
    INSERT INTO jobs (id, url, status, startTime, endTime, exitCode, downloadCount, skipCount,
                      batchCount, useUserConfigPath, createdAt, updatedAt)
    VALUES ('job-1', 'https://example.test/a', 'success', 100, 200, 0, 3, 1, NULL, 1, 100, 200),
           ('job-2', 'directlink batch', 'error', 300, 400, 1, 0, 0, 4, 0, 300, 400);
    INSERT INTO job_outputs (jobId, type, data, timestamp)
    VALUES ('job-1', 'stdout', 'line one', 150), ('job-2', 'stderr', 'boom', 350);
    INSERT INTO schedule_runs (id) VALUES ('run-1');
    INSERT INTO schedule_run_jobs (runId, jobId, url) VALUES ('run-1', 'job-1', 'https://example.test/a');
  `);
  return db;
}

function columnNames(database: Database.Database, table: string): string[] {
  return (database.pragma(`table_info(${table})`) as Array<{ name: string }>).map(
    (column) => column.name,
  );
}

function count(database: Database.Database, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number })
    .count;
}

function jobsRootPage(database: Database.Database): number {
  return (
    database
      .prepare("SELECT rootpage FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
      .get() as { rootpage: number }
  ).rootpage;
}

function insertJob(database: Database.Database, id: string, retryOfJobId: string | null): void {
  database
    .prepare(
      `INSERT INTO jobs (id, url, status, startTime, retryOfJobId, createdAt, updatedAt)
       VALUES (?, 'https://example.test/r', 'waiting', 1, ?, 1, 1)`,
    )
    .run(id, retryOfJobId);
}

afterEach(() => {
  vi.restoreAllMocks();
  db?.close();
  db = null;
});

describe('jobs table migration', () => {
  test('rebuilds a pre-queue table to the schema.sql column order and keeps every row', () => {
    const database = openLegacyDatabase(PRE_QUEUE_JOBS_SQL);

    migrateJobsTable(database);

    const fresh = new Database(':memory:');
    fresh.exec(SCHEMA_SQL);
    expect(columnNames(database, 'jobs')).toEqual(columnNames(fresh, 'jobs'));
    fresh.close();

    expect(database.prepare('SELECT * FROM jobs ORDER BY id').all()).toEqual([
      {
        id: 'job-1',
        url: 'https://example.test/a',
        status: 'success',
        startTime: 100,
        endTime: 200,
        exitCode: 0,
        downloadCount: 3,
        skipCount: 1,
        batchCount: null,
        useUserConfigPath: 1,
        queuePayload: null,
        retryOfJobId: null,
        createdAt: 100,
        updatedAt: 200,
      },
      {
        id: 'job-2',
        url: 'directlink batch',
        status: 'error',
        startTime: 300,
        endTime: 400,
        exitCode: 1,
        downloadCount: 0,
        skipCount: 0,
        batchCount: 4,
        useUserConfigPath: 0,
        queuePayload: null,
        retryOfJobId: null,
        createdAt: 300,
        updatedAt: 400,
      },
    ]);
    expect(count(database, 'job_outputs')).toBe(2);
    expect(count(database, 'schedule_run_jobs')).toBe(1);
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  test('cascade deletes still reach job_outputs and schedule_run_jobs after the rebuild', () => {
    const database = openLegacyDatabase(PRE_QUEUE_JOBS_SQL);

    migrateJobsTable(database);
    database.prepare("DELETE FROM jobs WHERE id = 'job-1'").run();

    expect(count(database, 'job_outputs')).toBe(1);
    expect(count(database, 'schedule_run_jobs')).toBe(0);
  });

  test('accepts waiting and nulls retryOfJobId when the parent job is deleted', () => {
    const database = openLegacyDatabase(PRE_QUEUE_JOBS_SQL);

    migrateJobsTable(database);
    insertJob(database, 'retry-1', 'job-2');
    database.prepare("DELETE FROM jobs WHERE id = 'job-2'").run();

    expect(
      database.prepare("SELECT status, retryOfJobId FROM jobs WHERE id = 'retry-1'").get(),
    ).toEqual({ status: 'waiting', retryOfJobId: null });
  });

  test('migrates the interim shape and keeps stored payloads', () => {
    const database = openLegacyDatabase(INTERIM_JOBS_SQL);
    database.prepare("UPDATE jobs SET queuePayload = '{\"v\":1}' WHERE id = 'job-2'").run();

    migrateJobsTable(database);

    expect(columnNames(database, 'jobs')).toContain('retryOfJobId');
    expect(database.prepare("SELECT queuePayload FROM jobs WHERE id = 'job-2'").get()).toEqual({
      queuePayload: '{"v":1}',
    });
    expect(count(database, 'job_outputs')).toBe(2);
  });

  test('a second run leaves the table alone', () => {
    const database = openLegacyDatabase(PRE_QUEUE_JOBS_SQL);
    migrateJobsTable(database);
    const rootPage = jobsRootPage(database);

    migrateJobsTable(database);

    expect(jobsRootPage(database)).toBe(rootPage);
  });

  test('does nothing on a fresh database', () => {
    db = new Database(':memory:');

    migrateJobsTable(db);

    expect(columnNames(db, 'jobs')).toEqual([]);
  });

  // The "would add violations" throw guards future edits to JOBS_TABLE_SQL or
  // CANONICAL_COLUMNS; no current input reaches it, so it has no test.
  test('migrates a database that already has orphan rows', () => {
    const database = openLegacyDatabase(PRE_QUEUE_JOBS_SQL);
    database.pragma('foreign_keys = OFF');
    database.exec(
      "INSERT INTO job_outputs (jobId, type, data, timestamp) VALUES ('missing', 'stdout', 'x', 1)",
    );
    database.pragma('foreign_keys = ON');
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);

    migrateJobsTable(database);

    expect(
      database.prepare("SELECT COUNT(*) AS count FROM job_outputs WHERE jobId = 'missing'").get(),
    ).toEqual({ count: 1 });
    expect(columnNames(database, 'jobs')).toContain('retryOfJobId');
    expect(columnNames(database, 'jobs')).toContain('queuePayload');
    expect(count(database, 'jobs')).toBe(2);
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/1 existing foreign key violation/);
  });
});
