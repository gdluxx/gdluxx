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
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import type * as BetterAuthShape from '../src/lib/server/auth/better-auth';
import type * as SessionManagerShape from '../src/lib/server/auth/sessionManager';

type BetterAuthModule = typeof BetterAuthShape;
type SessionManagerModule = typeof SessionManagerShape;

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';

const SCHEMA_SQL = readFileSync(new URL('../src/lib/server/schema.sql', import.meta.url), 'utf8');

// Mutable so each test can hand the loaded module a fresh db; the mock
// factory closes over this binding and is re-invoked on every vi.resetModules().
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

afterEach(() => {
  vi.useRealTimers();
});

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  // The logger's async config load and getUserCount() both call db.close();
  // closing the in-memory handle mid-file would invalidate later tests' fixtures.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  (db as unknown as { close: () => void }).close = () => {};
  db.exec(SCHEMA_SQL);
  return db;
}

// Skips better-auth entirely; only the integration test needs loadAuth.
async function loadSessionManager(): Promise<SessionManagerModule> {
  vi.resetModules();
  currentDb = freshDb();
  return import('$lib/server/auth/sessionManager');
}

async function loadAuth(): Promise<BetterAuthModule> {
  vi.resetModules();
  const db = freshDb();
  currentDb = db;
  return import('$lib/server/auth/better-auth');
}

let signupCounter = 0;

async function signUpAndGetSessionCookie(
  auth: BetterAuthModule['auth'],
): Promise<string | undefined> {
  signupCounter += 1;
  const { headers } = await auth.api.signUpEmail({
    returnHeaders: true,
    body: {
      email: `user-${signupCounter}@example.test`,
      password: 'correct-horse-battery-staple',
      name: 'Test User',
    },
  });
  return headers.getSetCookie().find((cookie) => cookie.includes('session_token='));
}

const USER_ID = 'u1';
const HOUR_MS = 1000 * 60 * 60;

function insertUser(db: Database.Database, id: string = USER_ID): void {
  db.prepare(`INSERT INTO user (id, email, createdAt, updatedAt) VALUES (?, ?, ?, ?)`).run(
    id,
    `${id}@example.test`,
    Date.now(),
    Date.now(),
  );
}

function insertSession(
  db: Database.Database,
  row: {
    id: string;
    token: string;
    expiresAt: string | number;
    createdAt: string | number;
    updatedAt: string | number;
    userId?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO session (id, token, expiresAt, userId, ipAddress, userAgent, createdAt, updatedAt)
     VALUES (@id, @token, @expiresAt, @userId, @ipAddress, @userAgent, @createdAt, @updatedAt)`,
  ).run({
    id: row.id,
    token: row.token,
    expiresAt: row.expiresAt,
    userId: row.userId ?? USER_ID,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

describe('listActiveSessions representation-robust filtering (AUTH-019c)', () => {
  test('ISO-text: unexpired session is returned, expired session is excluded', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'active-iso',
      token: 'token-active-iso',
      expiresAt: new Date(now + HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
    insertSession(currentDb, {
      id: 'expired-iso',
      token: 'token-expired-iso',
      expiresAt: new Date(now - HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['active-iso']);
  });

  test('epoch-ms integer: unexpired session is returned, expired session is excluded', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'active-int',
      token: 'token-active-int',
      expiresAt: now + HOUR_MS,
      createdAt: now,
      updatedAt: now,
    });
    insertSession(currentDb, {
      id: 'expired-int',
      token: 'token-expired-int',
      expiresAt: now - HOUR_MS,
      createdAt: now,
      updatedAt: now,
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['active-int']);
  });

  test('numeric-string epoch-ms behaves the same as integer epoch-ms', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'active-numstr',
      token: 'token-active-numstr',
      expiresAt: String(now + HOUR_MS),
      createdAt: String(now),
      updatedAt: String(now),
    });
    insertSession(currentDb, {
      id: 'expired-numstr',
      token: 'token-expired-numstr',
      expiresAt: String(now - HOUR_MS),
      createdAt: String(now),
      updatedAt: String(now),
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['active-numstr']);
  });

  test('mixed representations: all active rows returned regardless of representation, ordered by createdAt descending', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'iso-active',
      token: 'token-mixed-iso',
      expiresAt: new Date(now + HOUR_MS).toISOString(),
      createdAt: new Date(now - 3 * HOUR_MS).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
    insertSession(currentDb, {
      id: 'int-active',
      token: 'token-mixed-int',
      expiresAt: now + HOUR_MS,
      createdAt: now - 1 * HOUR_MS,
      updatedAt: now,
    });
    insertSession(currentDb, {
      id: 'numstr-active',
      token: 'token-mixed-numstr',
      expiresAt: String(now + HOUR_MS),
      createdAt: String(now - 2 * HOUR_MS),
      updatedAt: String(now),
    });
    insertSession(currentDb, {
      id: 'iso-expired',
      token: 'token-mixed-iso-expired',
      expiresAt: new Date(now - HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['int-active', 'numstr-active', 'iso-active']);
  });

  test('unparseable expiresAt is excluded (fail closed for display)', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'garbage-expiry',
      token: 'token-garbage',
      expiresAt: 'garbage',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
    insertSession(currentDb, {
      id: 'valid-active',
      token: 'token-valid',
      expiresAt: new Date(now + HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['valid-active']);
  });

  test('output format: ISO and numeric source rows both render ISO strings; empty ip/UA become null', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);

    const now = Date.now();
    const isoExpiry = new Date(now + HOUR_MS).toISOString();
    insertSession(currentDb, {
      id: 'iso-format',
      token: 'token-format-iso',
      expiresAt: isoExpiry,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      ipAddress: '',
      userAgent: 'Mozilla/5.0',
    });
    insertSession(currentDb, {
      id: 'int-format',
      token: 'token-format-int',
      expiresAt: now + HOUR_MS,
      createdAt: now,
      updatedAt: now,
      ipAddress: '127.0.0.1',
      userAgent: '',
    });

    const result = listActiveSessions(USER_ID);
    const isoRow = result.find((s) => s.id === 'iso-format');
    const intRow = result.find((s) => s.id === 'int-format');

    expect(isoRow).toBeDefined();
    expect(intRow).toBeDefined();

    for (const row of [isoRow!, intRow!]) {
      expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(row.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(row.expiresAt).toISOString()).toBe(row.expiresAt);
    }

    expect(isoRow!.ipAddress).toBeNull();
    expect(isoRow!.userAgent).toBe('Mozilla/5.0');
    expect(intRow!.ipAddress).toBe('127.0.0.1');
    expect(intRow!.userAgent).toBeNull();
  });

  test('unparseable expiresAt triggers exactly one warning naming the count; active rows still returned', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'garbage-expiry',
      token: 'token-garbage',
      expiresAt: 'garbage',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
    insertSession(currentDb, {
      id: 'valid-active',
      token: 'token-valid',
      expiresAt: new Date(now + HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['valid-active']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('1');

    warnSpy.mockRestore();
  });

  test('epoch-seconds-looking expiresAt is excluded as expired and triggers the warning', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const now = Date.now();
    const epochSecondsExpiry = Math.floor(now / 1000) + 3600;
    insertSession(currentDb, {
      id: 'epoch-seconds',
      token: 'token-epoch-seconds',
      expiresAt: epochSecondsExpiry,
      createdAt: now,
      updatedAt: now,
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  test('clean case: ISO rows only (active and genuinely expired) emit no warning', async () => {
    const { listActiveSessions } = await loadSessionManager();
    insertUser(currentDb);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const now = Date.now();
    insertSession(currentDb, {
      id: 'active-clean',
      token: 'token-active-clean',
      expiresAt: new Date(now + HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
    insertSession(currentDb, {
      id: 'expired-clean',
      token: 'token-expired-clean',
      expiresAt: new Date(now - HOUR_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    const result = listActiveSessions(USER_ID);

    expect(result.map((s) => s.id)).toEqual(['active-clean']);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('integration: real better-auth signup produces a session listActiveSessions accepts', async () => {
    const auth = await loadAuth();
    const { listActiveSessions } = await import('$lib/server/auth/sessionManager');

    const sessionCookie = await signUpAndGetSessionCookie(auth.auth);
    expect(sessionCookie).toBeDefined();

    const userRow = currentDb.prepare('SELECT id FROM user').get() as { id: string };

    const result = listActiveSessions(userRow.id);

    expect(result).toHaveLength(1);
    const [session] = result;
    expect(session.id).toEqual(expect.any(String));
    expect(() => new Date(session.expiresAt).toISOString()).not.toThrow();
    expect(new Date(session.expiresAt).toISOString()).toBe(session.expiresAt);
    expect(new Date(session.createdAt).toISOString()).toBe(session.createdAt);
    expect(new Date(session.updatedAt).toISOString()).toBe(session.updatedAt);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
