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
// The owner-scoping tests below seed a second user directly (bypassing the
// signup hook) to exercise cross-user isolation, which the production
// single-admin index forbids. Better Auth's own boot re-execs schema.sql
// (recreating the index if dropped earlier), so this must run after import,
// not in the hoisted db setup above.
db.exec('DROP INDEX IF EXISTS idx_user_singleton');
const { validateApiKey } = await import('$lib/server/auth/apiAuth');
const apiKeyManager = await import('$lib/server/apikey/apiKeyManager');
const { API_KEY_STATEMENTS } = await import('$lib/server/apikey/permissions');
const { backfillApiKeyPermissions } = await import('$lib/server/auth/apiKeyTableMigration');

interface ApiKeyRow {
  expiresAt: number | string | null;
}

interface PermissionsRow {
  permissions: string | null;
}

interface StartRow {
  start: string | null;
}

async function seedAdminUser(email: string): Promise<string> {
  const result = await auth.api.signUpEmail({
    body: { email, password: 'correct horse battery staple', name: 'Admin' },
  });
  return result.user.id;
}

// Bypasses signUpEmail and its single-admin hook for cross-user tests.
function seedUser(id: string, email: string): void {
  const ts = Date.now();
  db.prepare('INSERT INTO user (id, email, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(
    id,
    email,
    ts,
    ts,
  );
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
    const userId = await seedAdminUser('expiry-owner@example.test');
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const created = await apiKeyManager.createApiKey('expiring key', userId, sevenDaysOut);

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

describe('REM-014: default key expiration (manager-level, not plugin-level)', () => {
  test('apiKeyManager.createApiKey with expiry omitted gets a ~365-day default expiresAt', async () => {
    const userId = await seedAdminUser('no-expiry-owner@example.test');
    const before = Date.now();

    const created = await apiKeyManager.createApiKey('no explicit expiry', userId);

    expect(created.expiresAt).toBeDefined();

    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(created.expiresAt).toBeGreaterThan(before + 364 * oneDayMs);
    expect(created.expiresAt).toBeLessThan(before + 366 * oneDayMs);

    const row = db.prepare('SELECT expiresAt FROM apiKey WHERE id = ?').get(created.id) as
      | ApiKeyRow
      | undefined;
    expect(row?.expiresAt).not.toBeNull();
  });

  test('apiKeyManager.createApiKey with expiresAt: null stores a NULL expiresAt and the key still authenticates under strict permissions', async () => {
    const userId = await seedAdminUser('never-expires-owner@example.test');

    const created = await apiKeyManager.createApiKey('never expires', userId, null);

    expect(created.expiresAt).toBeUndefined();

    const row = db.prepare('SELECT expiresAt FROM apiKey WHERE id = ?').get(created.id) as
      | ApiKeyRow
      | undefined;
    expect(row?.expiresAt).toBeNull();

    // Never-expiring must not be a side door around permission verification.
    const result = await validateApiKey(created.key);
    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });
});

describe('REM-014: NULL-permission key backfill (migration-ordering contract)', () => {
  test('a NULL-permission key WITHOUT the backfill fails strict verification (enforcement is real)', async () => {
    const userId = await seedAdminUser('legacy-owner-unbackfilled@example.test');
    const created = await auth.api.createApiKey({
      body: { name: 'legacy key', userId, prefix: 'sk_' },
    });

    db.prepare('UPDATE apiKey SET permissions = NULL WHERE id = ?').run(created.id);

    const result = await validateApiKey(created.key);

    expect(result.success).toBe(false);
  });

  test('a NULL-permission key WITH the backfill authenticates (migration ordering holds)', async () => {
    const userId = await seedAdminUser('legacy-owner-backfilled@example.test');
    const created = await auth.api.createApiKey({
      body: { name: 'legacy key', userId, prefix: 'sk_' },
    });

    db.prepare('UPDATE apiKey SET permissions = NULL WHERE id = ?').run(created.id);

    backfillApiKeyPermissions(db);

    const result = await validateApiKey(created.key);

    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });
});

describe('REM-014: apiKeyManager ownership and permissions', () => {
  test('a newly created key stores the canonical permissions and verifies under strict required permissions', async () => {
    const userId = await seedAdminUser('canonical-owner@example.test');

    const created = await apiKeyManager.createApiKey('canonical key', userId);

    const row = db.prepare('SELECT permissions FROM apiKey WHERE id = ?').get(created.id) as
      | PermissionsRow
      | undefined;
    expect(row?.permissions).not.toBeNull();
    expect(JSON.parse(row!.permissions as string)).toEqual(API_KEY_STATEMENTS);

    const result = await validateApiKey(created.key);
    expect(result.success).toBe(true);
  });

  test('deleteApiKey is scoped to the owner: another user cannot delete it, the owner can', async () => {
    const userAId = 'owner-scope-user-a';
    const userBId = 'owner-scope-user-b';
    seedUser(userAId, 'owner-a@example.test');
    seedUser(userBId, 'owner-b@example.test');

    const created = await apiKeyManager.createApiKey('scoped key', userAId);

    await expect(apiKeyManager.deleteApiKey(created.id, userBId)).rejects.toThrow(
      'API key not found',
    );
    const stillThere = db.prepare('SELECT id FROM apiKey WHERE id = ?').get(created.id);
    expect(stillThere).toBeDefined();

    await expect(apiKeyManager.deleteApiKey(created.id, userAId)).resolves.toBeUndefined();
    const gone = db.prepare('SELECT id FROM apiKey WHERE id = ?').get(created.id);
    expect(gone).toBeUndefined();
  });

  test('listApiKeys scopes results to the requesting user', async () => {
    const userAId = 'list-scope-user-a';
    const userBId = 'list-scope-user-b';
    seedUser(userAId, 'list-a@example.test');
    seedUser(userBId, 'list-b@example.test');

    const keyA = await apiKeyManager.createApiKey('a key', userAId);
    await apiKeyManager.createApiKey('b key', userBId);

    const listedForA = await apiKeyManager.listApiKeys(userAId);

    expect(listedForA.map((k) => k.id)).toEqual([keyA.id]);
  });
});

describe('start storage disabled', () => {
  test('a manager-created key returns its plaintext key and is stored with start IS NULL', async () => {
    const userId = await seedAdminUser('start-disabled-owner@example.test');

    const created = await apiKeyManager.createApiKey('no stored start', userId);

    expect(created.key).toMatch(/^sk_/);

    const row = db.prepare('SELECT start FROM apiKey WHERE id = ?').get(created.id) as
      | StartRow
      | undefined;
    expect(row?.start).toBeNull();
  });

  test('a key with no stored start still verifies through both verification paths', async () => {
    const userId = await seedAdminUser('start-disabled-verify-owner@example.test');
    const created = await apiKeyManager.createApiKey('verifies without start', userId);

    const verified = await auth.api.verifyApiKey({ body: { key: created.key } });
    expect(verified.valid).toBe(true);
    expect(verified.key?.referenceId).toBe(userId);

    const result = await validateApiKey(created.key);
    expect(result.success).toBe(true);
    expect(result.keyInfo?.userId).toBe(userId);
  });

  test('semantics unaffected: default expiry and permissions still apply with start disabled', async () => {
    const userId = await seedAdminUser('start-disabled-expiry-owner@example.test');
    const before = Date.now();

    const created = await apiKeyManager.createApiKey('start disabled, still expires', userId);

    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(created.expiresAt).toBeDefined();
    expect(created.expiresAt).toBeGreaterThan(before + 364 * oneDayMs);
    expect(created.expiresAt).toBeLessThan(before + 366 * oneDayMs);

    const row = db
      .prepare('SELECT expiresAt, permissions, start FROM apiKey WHERE id = ?')
      .get(created.id) as (ApiKeyRow & PermissionsRow & StartRow) | undefined;
    expect(row?.expiresAt).not.toBeNull();
    expect(row?.permissions).not.toBeNull();
    expect(row?.start).toBeNull();
  });

  test('a pre-existing legacy row keeps its stored start; a newly created key gets none', async () => {
    const userId = await seedAdminUser('legacy-start-owner@example.test');
    const legacyTs = Date.now();
    db.prepare(
      `INSERT INTO apiKey (id, key, referenceId, start, prefix, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('legacy-start-key', 'legacy-hashed-key', userId, 'sk_abc', 'sk_', legacyTs, legacyTs);

    const created = await apiKeyManager.createApiKey('new key after legacy row', userId);

    const legacyRow = db
      .prepare('SELECT start FROM apiKey WHERE id = ?')
      .get('legacy-start-key') as StartRow | undefined;
    expect(legacyRow?.start).toBe('sk_abc');

    const newRow = db.prepare('SELECT start FROM apiKey WHERE id = ?').get(created.id) as
      | StartRow
      | undefined;
    expect(newRow?.start).toBeNull();
  });
});
