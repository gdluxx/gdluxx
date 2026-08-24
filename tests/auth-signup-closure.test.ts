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

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readFileSync(schemaUrl, 'utf8'));
  // close() would kill the shared singleton for the rest of the file; the
  // logger's async config load and getUserCount() both call it.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  database.close = (() => {}) as typeof database.close;
  return { db: database };
});

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => db,
  getSharedDatabase: () => db,
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

const { auth } = await import('$lib/server/auth/better-auth');

const PASSWORD = 'correct-horse-battery-staple';

function userCount(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number };
  return row.count;
}

describe('auth signup closure (REM-005: single-administrator enforcement)', () => {
  test('first signup from an empty user table succeeds and creates exactly one user', async () => {
    db.exec('DELETE FROM user');

    const result = await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: PASSWORD, name: 'Admin' },
    });

    expect(result.user.email).toBe('admin@example.test');
    expect(userCount()).toBe(1);
  });

  test('REM-005: second signup rejected after first user [flip to test() when REM-005 lands]', async () => {
    db.exec('DELETE FROM user');
    await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: PASSWORD, name: 'Admin' },
    });
    expect(userCount()).toBe(1);

    let rejected = false;
    try {
      await auth.api.signUpEmail({
        body: { email: 'second@example.test', password: PASSWORD, name: 'Second' },
      });
    } catch {
      rejected = true;
    }

    expect(rejected).toBe(true);
    expect(userCount()).toBe(1);
  });

  test('REM-005: two concurrent first-user signups yield exactly one user [flip to test() when REM-005 lands]', async () => {
    db.exec('DELETE FROM user');

    await Promise.allSettled([
      auth.api.signUpEmail({
        body: { email: 'concurrent-a@example.test', password: PASSWORD, name: 'A' },
      }),
      auth.api.signUpEmail({
        body: { email: 'concurrent-b@example.test', password: PASSWORD, name: 'B' },
      }),
    ]);

    expect(userCount()).toBe(1);
  });

  test('REM-005: AUTH-001 shape — raw signup after first user is rejected at the endpoint layer [flip to test() when REM-005 lands]', async () => {
    db.exec('DELETE FROM user');
    await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: PASSWORD, name: 'Admin' },
    });

    // Driving auth.api directly bypasses hooks.server.ts and any
    // Origin/Fetch-Metadata check performed there — this is the mechanism
    // AUTH-001 exploited: closure must hold at the Better Auth layer itself.
    await expect(
      auth.api.signUpEmail({
        body: { email: 'attacker@example.test', password: PASSWORD, name: 'Attacker' },
      }),
    ).rejects.toBeDefined();

    const response = await auth.handler(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker2@example.test',
          password: PASSWORD,
          name: 'Attacker2',
        }),
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
