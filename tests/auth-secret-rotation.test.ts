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
import type * as ApiKeyManagerShape from '../src/lib/server/apikey/apiKeyManager';
import type * as ApiAuthShape from '../src/lib/server/auth/apiAuth';

type BetterAuthModule = typeof BetterAuthShape;

const SECRET_A = 'a1a2a3a4a5a6a7a8a9aaabacadaeaf1011121314151617181920212223242526';
const SECRET_B = 'b1b2b3b4b5b6b7b8b9babbbcbdbebf1011121314151617181920212223242526';

const SCHEMA_SQL = readFileSync(new URL('../src/lib/server/schema.sql', import.meta.url), 'utf8');

const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;
const ORIGINAL_ORIGIN = process.env.ORIGIN;
process.env.ORIGIN = 'https://example.test';

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
  if (ORIGINAL_AUTH_SECRET === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
  }
  if (ORIGINAL_ORIGIN === undefined) {
    delete process.env.ORIGIN;
  } else {
    process.env.ORIGIN = ORIGINAL_ORIGIN;
  }
});

function createInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  // A real close() would kill the handle a later reboot in the same test
  // still needs.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  (db as unknown as { close: () => void }).close = () => {};
  db.exec(SCHEMA_SQL);
  return db;
}

// AUTH_SECRET is read at better-auth module load; resetModules is what makes
// a changed secret take effect.
async function bootAuth(db: Database.Database): Promise<BetterAuthModule> {
  vi.resetModules();
  currentDb = db;
  return import('$lib/server/auth/better-auth');
}

let signupCounter = 0;

// The singleton index allows one signup per db, so callers needing both the
// cookie and the user id must get them from this single call.
async function signUpUser(
  auth: BetterAuthModule['auth'],
): Promise<{ userId: string; cookiePair: string }> {
  signupCounter += 1;
  const { headers, response } = await auth.api.signUpEmail({
    returnHeaders: true,
    body: {
      email: `rotation-user-${signupCounter}@example.test`,
      password: 'correct-horse-battery-staple',
      name: 'Rotation Test User',
    },
  });
  const cookie = headers.getSetCookie().find((c) => c.includes('session_token='));
  if (!cookie) {
    throw new Error('signup did not return a session cookie');
  }
  return { userId: response.user.id, cookiePair: cookie.split(';')[0] };
}

describe('session survival across AUTH_SECRET rotation', () => {
  test('a session cookie signed under secret A is rejected after reboot with secret B, though the DB row survives', async () => {
    const db = createInMemoryDb();

    process.env.AUTH_SECRET = SECRET_A;
    const { auth: authA } = await bootAuth(db);
    const { cookiePair } = await signUpUser(authA);

    const sessionRowBefore = db.prepare('SELECT token FROM session').get() as
      | { token: string }
      | undefined;
    expect(sessionRowBefore?.token).toBeDefined();

    process.env.AUTH_SECRET = SECRET_B;
    const { auth: authB } = await bootAuth(db);

    const session = await authB.api.getSession({
      headers: new Headers({ cookie: cookiePair }),
    });

    expect(session).toBeNull();

    // The cookie's HMAC signature is keyed by AUTH_SECRET; the row never changes.
    const sessionRowAfter = db.prepare('SELECT token FROM session').get() as
      | { token: string }
      | undefined;
    expect(sessionRowAfter?.token).toBe(sessionRowBefore?.token);
  });
});

describe('API key survival across AUTH_SECRET rotation', () => {
  test('an API key created under secret A still verifies (via apiAuth.validateApiKey) after reboot with secret B', async () => {
    const db = createInMemoryDb();

    process.env.AUTH_SECRET = SECRET_A;
    const { auth: authA } = await bootAuth(db);
    const { userId, cookiePair } = await signUpUser(authA);
    const apiKeyManagerA: typeof ApiKeyManagerShape =
      await import('$lib/server/apikey/apiKeyManager');
    const created = await apiKeyManagerA.createApiKey('rotation key', userId);

    process.env.AUTH_SECRET = SECRET_B;
    const { auth: authB } = await bootAuth(db);
    const apiAuthB: typeof ApiAuthShape = await import('$lib/server/auth/apiAuth');

    // The secret-signed cookie failing proves rotation took effect in this boot.
    const rotatedSession = await authB.api.getSession({
      headers: new Headers({ cookie: cookiePair }),
    });
    expect(rotatedSession).toBeNull();

    const result = await apiAuthB.validateApiKey(created.key);

    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });
});

describe('reboot-alone sanity check (control: same secret, no rotation)', () => {
  test('both a session and an API key still verify after a module reset when AUTH_SECRET is unchanged', async () => {
    const db = createInMemoryDb();
    process.env.AUTH_SECRET = SECRET_A;

    const { auth: authFirstBoot } = await bootAuth(db);
    const { userId, cookiePair } = await signUpUser(authFirstBoot);
    const apiKeyManagerFirstBoot: typeof ApiKeyManagerShape =
      await import('$lib/server/apikey/apiKeyManager');
    const created = await apiKeyManagerFirstBoot.createApiKey('sanity-check key', userId);

    const { auth: authSecondBoot } = await bootAuth(db);
    const apiAuthSecondBoot: typeof ApiAuthShape = await import('$lib/server/auth/apiAuth');

    const session = await authSecondBoot.api.getSession({
      headers: new Headers({ cookie: cookiePair }),
    });
    expect(session?.user.id).toBe(userId);

    const result = await apiAuthSecondBoot.validateApiKey(created.key);
    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });
});
