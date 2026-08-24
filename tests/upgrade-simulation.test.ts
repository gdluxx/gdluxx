/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Single-purpose upgrade cases covered elsewhere (session token-column
 * migration, AUTH_SECRET boot refusal, isolated backfill ordering) are not
 * repeated here; see tests/better-auth-migration.test.ts,
 * tests/auth-secret.test.ts, and tests/api-key-verify.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CreateScheduleInput } from '../src/lib/server/schedules/scheduleManager';

process.env.AUTH_SECRET = 'ab'.repeat(32);

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const { migrateApiKeyTable } = await import('../src/lib/server/auth/apiKeyTableMigration');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readFileSync(schemaUrl, 'utf8'));
  // Pre-create the canonical apiKey table so every test's cleanup can rely on
  // it existing regardless of run order.
  migrateApiKeyTable(database);
  // Shared singleton; a real close() would kill it for the rest of the file.
  database.close = () => database;
  return { db: database };
});

// Mutable so the one deliberately-corrupted-state test can hand the module-load
// migration a different database without disturbing the shared fixture.
let currentDb = db;

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => currentDb,
  getSharedDatabase: () => currentDb,
}));
vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let currentTmpDir = '';
vi.mock('$lib/server/constants', () => ({
  PATHS: {
    get BIN_FILE() {
      return join(currentTmpDir, 'gallery-dl.bin');
    },
    get DATA_DIR() {
      return currentTmpDir;
    },
    get CONFIG_FILE() {
      return join(currentTmpDir, 'config.json');
    },
    get COOKIES_DIR() {
      return join(currentTmpDir, 'cookies');
    },
  },
  TERMINAL: { NAME: 'xterm-256color', COLS: 120, ROWS: 30 },
  API_LIMITS: { MAX_BATCH_URLS: 10000 },
}));

const executeGalleryDlCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
  executeGalleryDlBatchCommand: vi.fn(),
}));

// Static: these don't depend on better-auth.ts and stay valid across the
// vi.resetModules() calls the auth-boot tests use.
const { launchUrls } = await import('$lib/server/jobs/commandLauncher');
const { ConfigExecutionBlockedError } = await import('$lib/server/validation/exec-policy');
const { resetConfigGuardCache } = await import('$lib/server/jobs/configGuard');
const scheduleManager = await import('$lib/server/schedules/scheduleManager');
const scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
const { dispatchRun } = await import('$lib/server/schedules/dispatchRun');
const { API_KEY_STATEMENTS } = await import('$lib/server/apikey/permissions');

const SEED_TS = 1_700_000_000_000;

async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    process.env[key] = vars[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (original[key] === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

function seedUser(id: string): void {
  db.prepare('INSERT INTO user (id, email, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(
    id,
    `${id}@example.test`,
    SEED_TS,
    SEED_TS,
  );
}

function seedJob(id: string, status: 'success'): void {
  db.prepare(
    'INSERT INTO jobs (id, url, status, startTime, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `https://example.test/${id}`, status, SEED_TS, SEED_TS, SEED_TS);
}

function scheduleInput(overrides: Partial<CreateScheduleInput> = {}): CreateScheduleInput {
  return {
    userId: 'user-1',
    name: 'Test schedule',
    status: 'active',
    timezone: 'UTC',
    recurrence: { kind: 'daily', time: '09:00' },
    startDate: '2026-01-01',
    endDate: null,
    misfirePolicy: 'skip',
    commandSource: { urls: ['https://example.test/a'], userOptions: [], excludedOptions: [] },
    siteOptionsSnapshot: {},
    nextOccurrenceAt: SEED_TS + 1000,
    ...overrides,
  };
}

function writeConfig(content: string): void {
  writeFileSync(join(currentTmpDir, 'config.json'), content, 'utf-8');
}

function hostileConfig(): string {
  return JSON.stringify({
    extractor: { postprocessors: [{ name: 'exec', command: ['gdluxx-rem006-sentinel'] }] },
  });
}

function benignConfig(): string {
  return JSON.stringify({ extractor: { 'base-directory': join(currentTmpDir, 'downloads') } });
}

beforeEach(() => {
  vi.clearAllMocks();
  executeGalleryDlCommandMock.mockResolvedValue({ success: true, jobId: 'unused' });
  currentTmpDir = mkdtempSync(join(tmpdir(), 'gdluxx-upgrade-sim-'));
  writeFileSync(join(currentTmpDir, 'gallery-dl.bin'), '', { mode: 0o755 });
  writeConfig(benignConfig());
  resetConfigGuardCache();
});

afterEach(() => {
  resetConfigGuardCache();
  rmSync(currentTmpDir, { recursive: true, force: true });
  db.exec(`
    DELETE FROM schedule_notifications;
    DELETE FROM schedule_run_jobs;
    DELETE FROM schedule_runs;
    DELETE FROM schedules;
    DELETE FROM jobs;
    DELETE FROM apiKey;
    DELETE FROM verification;
    DELETE FROM session;
    DELETE FROM account;
    DELETE FROM user;
  `);
});

describe('upgrade simulation: legacy auth state carried through a real startup-path boot', () => {
  test('credentials survive, the legacy apiKey is backfilled (expiry untouched, key still verifies), and re-running the backfill changes nothing further', async () => {
    // "Before the upgrade": construct the legacy install using the current
    // module (no old code available), then hand-edit the apiKey row back to
    // its pre-Phase-3 shape, exactly as api-key-verify.test.ts does.
    currentDb = db;
    vi.resetModules();
    const { auth: authBeforeUpgrade } = await import('$lib/server/auth/better-auth');

    const signedUp = await authBeforeUpgrade.api.signUpEmail({
      body: {
        email: 'legacy-admin@example.test',
        password: 'correct horse battery staple',
        name: 'Legacy Admin',
      },
    });
    const userId = signedUp.user.id;

    const createdKey = await authBeforeUpgrade.api.createApiKey({
      body: { name: 'legacy extension key', userId, prefix: 'sk_' },
    });
    // Only permissions needs resetting: a direct auth.api.createApiKey call
    // with no expiresIn never sets expiresAt.
    db.prepare('UPDATE apiKey SET permissions = NULL WHERE id = ?').run(createdKey.id);

    const legacySessionId = 'legacy-session-1';
    db.prepare(
      `INSERT INTO session (id, token, expiresAt, userId, ipAddress, userAgent, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      legacySessionId,
      'gdluxx-legacy-session-token-sentinel',
      SEED_TS + 1000 * 60 * 60 * 24 * 30,
      userId,
      null,
      null,
      SEED_TS,
      SEED_TS,
    );

    const legacyVerificationId = 'legacy-verification-1';
    db.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      legacyVerificationId,
      'legacy-admin@example.test',
      'gdluxx-legacy-verification-sentinel',
      SEED_TS + 1000 * 60 * 60,
      SEED_TS,
      SEED_TS,
    );

    const beforeUser = db.prepare('SELECT * FROM user WHERE id = ?').get(userId);
    const beforeAccount = db.prepare('SELECT * FROM account WHERE userId = ?').get(userId);
    const beforeVerification = db
      .prepare('SELECT * FROM verification WHERE id = ?')
      .get(legacyVerificationId);
    const beforeSession = db.prepare('SELECT * FROM session WHERE id = ?').get(legacySessionId);

    vi.resetModules();
    let validateApiKeyAfterUpgrade: (
      key: unknown,
    ) => Promise<{ success: boolean; keyInfo?: { userId: string } }>;
    let backfillAfterUpgrade: (database: typeof db) => void;
    await withEnv({ NODE_ENV: 'production' }, async () => {
      ({ validateApiKey: validateApiKeyAfterUpgrade } = await import('$lib/server/auth/apiAuth'));
      ({ backfillApiKeyPermissions: backfillAfterUpgrade } =
        await import('$lib/server/auth/apiKeyTableMigration'));
    });

    expect(db.prepare('SELECT * FROM user WHERE id = ?').get(userId)).toEqual(beforeUser);
    expect(db.prepare('SELECT * FROM account WHERE userId = ?').get(userId)).toEqual(beforeAccount);
    expect(db.prepare('SELECT * FROM verification WHERE id = ?').get(legacyVerificationId)).toEqual(
      beforeVerification,
    );
    expect(db.prepare('SELECT * FROM session WHERE id = ?').get(legacySessionId)).toEqual(
      beforeSession,
    );

    const apiKeyRow = db
      .prepare('SELECT permissions, expiresAt FROM apiKey WHERE id = ?')
      .get(createdKey.id) as { permissions: string | null; expiresAt: number | string | null };
    expect(JSON.parse(apiKeyRow.permissions as string)).toEqual(API_KEY_STATEMENTS);
    expect(apiKeyRow.expiresAt).toBeNull();

    const verified = await validateApiKeyAfterUpgrade!(createdKey.key);
    expect(verified.success).toBe(true);
    expect(verified.keyInfo?.userId).toBe(userId);

    const beforeSecondBackfill = db
      .prepare('SELECT permissions, updatedAt FROM apiKey WHERE id = ?')
      .get(createdKey.id);
    backfillAfterUpgrade!(db);
    const afterSecondBackfill = db
      .prepare('SELECT permissions, updatedAt FROM apiKey WHERE id = ?')
      .get(createdKey.id);
    expect(afterSecondBackfill).toEqual(beforeSecondBackfill);
  });
});

describe('upgrade simulation: a config.json left over from before the upgrade', () => {
  test('a prohibited config blocks execution; the mocked executor is never reached', async () => {
    writeConfig(hostileConfig());

    await expect(
      launchUrls({
        urls: ['https://sentinel.invalid/a'],
        args: [],
        excludedOptions: [],
        resolveSiteOptions: async () => [],
      }),
    ).rejects.toBeInstanceOf(ConfigExecutionBlockedError);

    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
  });

  test('regression: a benign persisted config still launches', async () => {
    const results = await launchUrls({
      urls: ['https://sentinel.invalid/a'],
      args: [],
      excludedOptions: [],
      resolveSiteOptions: async () => [],
    });

    expect(results).toEqual([
      { url: 'https://sentinel.invalid/a', success: true, jobId: 'unused' },
    ]);
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
  });
});

describe('upgrade simulation: schedules left over from before the upgrade', () => {
  test('a schedule with prohibited userOptions is contained at dispatch: launch_failed + notification, row intact', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['postprocessor', 'exec']],
          excludedOptions: [],
        },
      }),
    );
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'manual',
      outcome: 'dispatching',
      scheduledFor: Date.now(),
      urlCount: schedule.commandSource.urls.length,
    });

    const { outcome } = await dispatchRun(schedule, run.id, {
      launch: launchUrls,
      getMaxBatchUrls: () => 200,
    });

    expect(outcome).toBe('launch_failed');
    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();

    const notification = db
      .prepare(
        "SELECT * FROM schedule_notifications WHERE scheduleId = ? AND type = 'launch_failed'",
      )
      .get(schedule.id);
    expect(notification).toBeDefined();

    const stored = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(stored?.commandSource).toEqual(schedule.commandSource);
  });

  test('regression: a valid stored schedule dispatches normally', async () => {
    seedUser('user-1');
    seedJob('job-benign', 'success');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['verbose', true]],
          excludedOptions: [],
        },
      }),
    );
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'manual',
      outcome: 'dispatching',
      scheduledFor: Date.now(),
      urlCount: schedule.commandSource.urls.length,
    });
    executeGalleryDlCommandMock.mockResolvedValueOnce({ success: true, jobId: 'job-benign' });

    const { outcome } = await dispatchRun(schedule, run.id, {
      launch: launchUrls,
      getMaxBatchUrls: () => 200,
    });

    expect(outcome).toBe('launched');
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
  });
});

describe('upgrade simulation: fail-closed on a corrupted pre-existing install', () => {
  test('boot aborts instead of serving when the user table already holds duplicate rows before the singleton index exists', async () => {
    const { default: Database } = await import('better-sqlite3');
    const brokenDb = new Database(':memory:');
    // Legacy shape predating the REM-005 singleton index.
    brokenDb.exec(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
    brokenDb
      .prepare('INSERT INTO user (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run('corrupt-user-1', 'admin1@example.test', 'Admin One', SEED_TS, SEED_TS);
    brokenDb
      .prepare('INSERT INTO user (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run('corrupt-user-2', 'admin2@example.test', 'Admin Two', SEED_TS, SEED_TS);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      currentDb = brokenDb;
      vi.resetModules();
      await withEnv({ NODE_ENV: 'production' }, async () => {
        await expect(import('$lib/server/auth/better-auth')).rejects.toThrow();
      });

      // Fail closed, not fail erased.
      const count = (
        brokenDb.prepare('SELECT COUNT(*) AS count FROM user').get() as { count: number }
      ).count;
      expect(count).toBe(2);
    } finally {
      consoleErrorSpy.mockRestore();
      currentDb = db;
      vi.resetModules();
      brokenDb.close();
    }
  });
});
