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

type BetterAuthModule = typeof BetterAuthShape;

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';

const SCHEMA_SQL = readFileSync(new URL('../src/lib/server/schema.sql', import.meta.url), 'utf8');

const ORIGINAL_ORIGIN = process.env.ORIGIN;
const ORIGINAL_USE_SECURE_COOKIES = process.env.USE_SECURE_COOKIES;

// Mutable so each test can hand better-auth a fresh db; the mock factory
// closes over this binding and is re-invoked on every vi.resetModules().
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

function restoreEnv(): void {
  if (ORIGINAL_ORIGIN === undefined) {
    delete process.env.ORIGIN;
  } else {
    process.env.ORIGIN = ORIGINAL_ORIGIN;
  }
  if (ORIGINAL_USE_SECURE_COOKIES === undefined) {
    delete process.env.USE_SECURE_COOKIES;
  } else {
    process.env.USE_SECURE_COOKIES = ORIGINAL_USE_SECURE_COOKIES;
  }
}

afterEach(() => {
  restoreEnv();
  vi.useRealTimers();
});

// The logger's async config load and getUserCount() both call db.close();
// closing the in-memory handle mid-file would invalidate later tests' fixtures.
async function loadAuth(): Promise<BetterAuthModule> {
  vi.resetModules();
  const db = new Database(':memory:');
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  (db as unknown as { close: () => void }).close = () => {};
  db.exec(SCHEMA_SQL);
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

describe('cookie Secure derivation from ORIGIN scheme (regression guard, REM-009a)', () => {
  test('USE_SECURE_COOKIES unset + https ORIGIN: session cookie includes Secure', async () => {
    delete process.env.USE_SECURE_COOKIES;
    process.env.ORIGIN = 'https://example.test';
    const { auth } = await loadAuth();

    const sessionCookie = await signUpAndGetSessionCookie(auth);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/;\s*Secure/i);
  });

  test('USE_SECURE_COOKIES unset + http ORIGIN: session cookie has no Secure, signup still works', async () => {
    delete process.env.USE_SECURE_COOKIES;
    process.env.ORIGIN = 'http://localhost:7755';
    const { auth } = await loadAuth();

    const sessionCookie = await signUpAndGetSessionCookie(auth);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).not.toMatch(/;\s*Secure/i);
  });

  test('USE_SECURE_COOKIES=true forces Secure regardless of scheme', async () => {
    process.env.USE_SECURE_COOKIES = 'true';
    process.env.ORIGIN = 'http://localhost:7755';
    const { auth } = await loadAuth();

    const sessionCookie = await signUpAndGetSessionCookie(auth);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/;\s*Secure/i);
  });

  test('USE_SECURE_COOKIES=false suppresses Secure regardless of scheme', async () => {
    process.env.USE_SECURE_COOKIES = 'false';
    process.env.ORIGIN = 'https://example.test';
    const { auth } = await loadAuth();

    const sessionCookie = await signUpAndGetSessionCookie(auth);

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).not.toMatch(/;\s*Secure/i);
  });
});

describe('absolute session expiration cap (REM-009b: disableSessionRefresh)', () => {
  test('REM-009: session.disableSessionRefresh is true, capping expiresIn as an absolute limit', async () => {
    delete process.env.USE_SECURE_COOKIES;
    process.env.ORIGIN = 'https://example.test';
    const { auth } = await loadAuth();

    // Config-level proxy for the absolute-session-cap behavior: without
    // this flag, every request within `updateAge` slides expiresAt
    // forward, so a session can never reach its `expiresIn` cap.
    expect(
      (auth as unknown as { options: { session?: { disableSessionRefresh?: boolean } } }).options
        .session?.disableSessionRefresh,
    ).toBe(true);
  });

  test('REM-009: session expiresAt does not slide forward past updateAge activity', async () => {
    delete process.env.USE_SECURE_COOKIES;
    process.env.ORIGIN = 'https://example.test';
    const { auth } = await loadAuth();

    const sessionCookie = await signUpAndGetSessionCookie(auth);
    expect(sessionCookie).toBeDefined();
    const cookiePair = sessionCookie!.split(';')[0];

    const expiresAtBefore = (
      currentDb.prepare('SELECT expiresAt FROM session').get() as {
        expiresAt: string | number;
      }
    ).expiresAt;

    // updateAge is 1 day; travel past it (but within the 7-day expiresIn)
    // so a live session is exercised, not an expired one.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 24 * 2);

    await auth.api.getSession({ headers: new Headers({ cookie: cookiePair }) });

    const expiresAtAfter = (
      currentDb.prepare('SELECT expiresAt FROM session').get() as {
        expiresAt: string | number;
      }
    ).expiresAt;

    expect(expiresAtAfter).toBe(expiresAtBefore);
  });
});
