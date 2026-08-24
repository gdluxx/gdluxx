/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// `test.fails` cases define pending remediation behavior and become plain tests once it ships.

import { afterEach, describe, expect, test, vi } from 'vitest';

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readFileSync(schemaUrl, 'utf8'));
  // shared singleton; real close() kills it for later tests, so no-op it
  // (return `database` to match better-sqlite3's chainable close() signature)
  database.close = () => database;
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
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<
    { default: Record<string, unknown> } & Record<string, unknown>
  >();
  const realExistsSync = actual.existsSync as (p: unknown) => boolean;
  const existsSync = (p: unknown): boolean => p === ':memory:' || realExistsSync(p);
  return { ...actual, default: { ...actual.default, existsSync }, existsSync };
});

const { auth } = await import('$lib/server/auth/better-auth');
const { validateApiKey } = await import('$lib/server/auth/apiAuth');
const apiKeyManager = await import('$lib/server/apikey/apiKeyManager');

interface ApiKeyRow {
  expiresAt: number | string | null;
}

async function seedAdminUser(email: string): Promise<string> {
  const result = await auth.api.signUpEmail({
    body: { email, password: 'correct horse battery staple', name: 'Admin' },
  });
  return result.user.id;
}

afterEach(() => {
  db.exec('DELETE FROM apiKey; DELETE FROM user;');
});

describe('verifyApiKey round-trip (regression)', () => {
  test('a freshly created key verifies valid and resolves to its owner', async () => {
    const userId = await seedAdminUser('owner@example.test');
    const created = await auth.api.createApiKey({
      body: { name: 'round-trip key', userId, prefix: 'sk_' },
    });

    const verified = await auth.api.verifyApiKey({ body: { key: created.key } });

    expect(verified.valid).toBe(true);
    expect(verified.key?.referenceId).toBe(userId);
  });

  test('validateApiKey resolves the same owner for a valid key', async () => {
    const userId = await seedAdminUser('owner2@example.test');
    const created = await auth.api.createApiKey({
      body: { name: 'apiAuth round-trip key', userId, prefix: 'sk_' },
    });

    const result = await validateApiKey(created.key);

    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });

  test('a garbage key is rejected, not accepted', async () => {
    let outcome: { valid: boolean } | undefined;
    let rejected = false;
    try {
      outcome = await auth.api.verifyApiKey({ body: { key: 'sk_not-a-real-key-0123456789' } });
    } catch {
      rejected = true;
    }

    expect(rejected || outcome?.valid === false).toBe(true);
  });
});

describe('createApiKey expiresAt unit conversion (regression)', () => {
  test('a 7-day expiry is stored and returned in milliseconds, not seconds', async () => {
    await seedAdminUser('expiry-owner@example.test');
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const created = await apiKeyManager.createApiKey('expiring key', sevenDaysOut);

    const toleranceMs = 60 * 1000;
    expect(created.expiresAt).toBeDefined();
    expect(created.expiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(created.expiresAt).toBeLessThan(Date.now() + 8 * 24 * 60 * 60 * 1000);

    const row = db.prepare('SELECT expiresAt FROM apiKey WHERE id = ?').get(created.id) as
      | ApiKeyRow
      | undefined;

    expect(row?.expiresAt).not.toBeNull();
    // better-auth's sqlite adapter persists Date fields as ISO strings, not
    // raw epoch ms, despite the INTEGER column affinity in apiKeyTableMigration.ts.
    const storedExpiresAt = new Date(row!.expiresAt as number | string).getTime();
    expect(storedExpiresAt).toBeGreaterThan(sevenDaysOut.getTime() - toleranceMs);
    expect(storedExpiresAt).toBeLessThan(sevenDaysOut.getTime() + toleranceMs);
  });
});

describe('REM-014: default key expiration', () => {
  test.fails('a key created with no explicit expiry still gets a default expiresAt', async () => {
    const userId = await seedAdminUser('no-expiry-owner@example.test');

    const created = await auth.api.createApiKey({
      body: { name: 'no explicit expiry', userId, prefix: 'sk_' },
    });

    expect(created.expiresAt).not.toBeNull();
    expect(created.expiresAt).toBeDefined();
  });
});

describe('REM-014: existing NULL-permission key keeps authenticating (backfill must not strand it)', () => {
  // gdluxx verifies extension keys without a required-permission set, so a
  // NULL-permission key must remain valid when default permissions are added.
  // Better Auth applies defaults only when creating a key, not while verifying
  // a pre-existing row.
  test('a key with permissions=NULL still authenticates via the gdluxx verify path', async () => {
    const userId = await seedAdminUser('legacy-owner@example.test');
    const created = await auth.api.createApiKey({
      body: { name: 'legacy key', userId, prefix: 'sk_' },
    });

    db.prepare('UPDATE apiKey SET permissions = NULL WHERE id = ?').run(created.id);

    const result = await validateApiKey(created.key);

    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });
});
