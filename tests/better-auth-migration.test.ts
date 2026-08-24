/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { describe, expect, test, vi } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';

const SCHEMA_SQL = readFileSync(new URL('../src/lib/server/schema.sql', import.meta.url), 'utf8');

// Mutable so each test can hand the module-load migration a different
// fixture before importing; the mock factory closes over this binding.
let currentDb: Database.Database;

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => currentDb,
  getSharedDatabase: () => currentDb,
}));
vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// A blanket existsSync mock breaks better-auth's schema probe (drops apiKey table);
// scope the override to the DATABASE_PATH sentinel only.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<
    { default: Record<string, unknown> } & Record<string, unknown>
  >();
  const realExistsSync = actual.existsSync as (p: unknown) => boolean;
  const existsSync = (p: unknown): boolean => p === ':memory:' || realExistsSync(p);
  return { ...actual, default: { ...actual.default, existsSync }, existsSync };
});

function seedUserAndAccount(db: Database.Database): void {
  const ts = 1_700_000_000_000;
  db.prepare('INSERT INTO user (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)').run(
    'user-1',
    'admin@example.test',
    'Admin',
    ts,
    ts,
  );
  db.prepare(
    `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('account-1', 'admin@example.test', 'credential', 'user-1', 'hashed-password', ts, ts);
}

function userRowCount(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM user').get() as { count: number }).count;
}

function accountRowCount(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM account').get() as { count: number }).count;
}

// The logger's async config load and getUserCount() both call db.close();
// closing the in-memory handle mid-file would invalidate later tests' fixtures.
function disableClose(db: Database.Database): void {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  (db as unknown as { close: () => void }).close = () => {};
}

describe('better-auth startup migration (REM-003: fatal, non-destructive migration)', () => {
  test('current-schema db: user/account rows survive import, and additive migrations still run', async () => {
    vi.resetModules();
    const db = new Database(':memory:');
    disableClose(db);
    db.exec(SCHEMA_SQL);
    seedUserAndAccount(db);
    currentDb = db;

    await import('$lib/server/auth/better-auth');

    expect(userRowCount(db)).toBe(1);
    expect(accountRowCount(db)).toBe(1);

    const apiKeyInfo = db.pragma('table_info(apiKey)') as Array<{ name: string }>;
    expect(apiKeyInfo.length).toBeGreaterThan(0);

    const userInfo = db.pragma('table_info(user)') as Array<{ name: string }>;
    expect(userInfo.some((column) => column.name === 'maxBatchUrls')).toBe(true);
  });

  test('REM-003: legacy pre-token db — user/account rows survive import', async () => {
    vi.resetModules();
    const db = new Database(':memory:');
    disableClose(db);
    // Pre-migration shape: `session` has no `token` column, the condition
    // that used to drop session, account, verification and user.
    db.exec(`
        CREATE TABLE user (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE TABLE session (
          id TEXT PRIMARY KEY,
          expiresAt INTEGER NOT NULL,
          userId TEXT NOT NULL,
          ipAddress TEXT,
          userAgent TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE TABLE account (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          providerId TEXT NOT NULL,
          userId TEXT NOT NULL,
          password TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE TABLE verification (
          id TEXT PRIMARY KEY,
          identifier TEXT NOT NULL,
          value TEXT NOT NULL,
          expiresAt INTEGER NOT NULL,
          createdAt INTEGER NOT NULL
        );
      `);
    seedUserAndAccount(db);
    currentDb = db;

    await import('$lib/server/auth/better-auth');

    expect(userRowCount(db)).toBe(1);
    expect(accountRowCount(db)).toBe(1);
  });

  test('REM-003: a failed migration step is fatal — import rejects instead of resolving', async () => {
    vi.resetModules();
    const db = new Database(':memory:');
    disableClose(db);
    // hasTokenColumn = true skips the drop branch, so the module's first
    // db.exec call is the schema re-application — the call this fixture
    // breaks to simulate a migration step failing mid-flight.
    db.exec(`
        CREATE TABLE session (
          id TEXT PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          expiresAt INTEGER NOT NULL,
          userId TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );
      `);
    db.exec = (): never => {
      throw new Error('simulated migration failure');
    };
    currentDb = db;

    await expect(import('$lib/server/auth/better-auth')).rejects.toThrow();
  });
});
