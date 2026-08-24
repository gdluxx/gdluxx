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
 * site_configs.cli_options has no storage-time prohibited-id check;
 * containment is solely execution-time via assertOptionIdsAllowed.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CreateScheduleInput } from '../src/lib/server/schedules/scheduleManager';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readFileSync(schemaUrl, 'utf8'));
  return { db: database };
});

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => db,
  getSharedDatabase: () => db,
}));

// launchUrls's binary probe must not depend on data/gallery-dl.bin existing
// on whatever machine runs the suite.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<
    { default: Record<string, unknown> } & Record<string, unknown>
  >();
  return {
    ...actual,
    default: { ...actual.default, accessSync: vi.fn() },
    accessSync: vi.fn(),
  };
});

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Isolate the site-options assertions from the machine-local persisted config;
// exec-containment-runtime.test.ts covers the config-guard boundary itself.
vi.mock('$lib/server/jobs/configGuard', () => ({
  assertConfigFileSafeForExecution: vi.fn().mockResolvedValue(undefined),
  resetConfigGuardCache: vi.fn(),
}));

const executeGalleryDlCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
  executeGalleryDlBatchCommand: vi.fn(),
}));

const { siteConfigManager } = await import('$lib/server/siteConfigManager');
const { launchUrls } = await import('$lib/server/jobs/commandLauncher');
const { ProhibitedOptionError } = await import('$lib/server/validation/exec-policy');
const { buildSiteOptionsSnapshot } = await import('$lib/server/schedules/snapshotService');
const scheduleManager = await import('$lib/server/schedules/scheduleManager');
const scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
const { dispatchRun } = await import('$lib/server/schedules/dispatchRun');

const SEED_TS = 1_700_000_000_000;

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

beforeEach(() => {
  vi.clearAllMocks();
  executeGalleryDlCommandMock.mockResolvedValue({ success: true, jobId: 'unused' });
});

afterEach(() => {
  db.exec(`
    DELETE FROM schedule_notifications;
    DELETE FROM schedule_run_jobs;
    DELETE FROM schedule_runs;
    DELETE FROM schedules;
    DELETE FROM jobs;
    DELETE FROM site_configs;
    DELETE FROM user;
  `);
});

describe('interactive launch: a stored site rule carries a prohibited option id', () => {
  test('the prohibited id is contained at launch: launchUrls rejects, spawn never reached, the site_configs row is untouched', async () => {
    const id = await siteConfigManager.createSiteConfig({
      site_pattern: 'hostile.sentinel.invalid',
      display_name: 'Hostile rule (fixture)',
      cli_options: [['postprocessor-option', 'gdluxx-rem006-sentinel=1']],
      is_default: false,
      enabled: true,
    });
    const before = await siteConfigManager.getSiteConfigById(id);

    await expect(
      launchUrls({
        urls: ['https://hostile.sentinel.invalid/gallery/1'],
        args: [],
        excludedOptions: [],
        resolveSiteOptions: (url) => siteConfigManager.getCliOptionsForUrl(url),
      }),
    ).rejects.toBeInstanceOf(ProhibitedOptionError);

    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
    expect(await siteConfigManager.getSiteConfigById(id)).toEqual(before);
  });

  test('regression: a benign site rule still launches normally', async () => {
    await siteConfigManager.createSiteConfig({
      site_pattern: 'benign.sentinel.invalid',
      display_name: 'Benign rule (fixture)',
      cli_options: [['verbose', true]],
      is_default: false,
      enabled: true,
    });

    const results = await launchUrls({
      urls: ['https://benign.sentinel.invalid/gallery/1'],
      args: [],
      excludedOptions: [],
      resolveSiteOptions: (url) => siteConfigManager.getCliOptionsForUrl(url),
    });

    expect(results).toEqual([
      { url: 'https://benign.sentinel.invalid/gallery/1', success: true, jobId: 'unused' },
    ]);
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
    const [, cliArgs] = executeGalleryDlCommandMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).toContain('--verbose');
  });
});

describe('scheduled dispatch: a prohibited site rule carried in siteOptionsSnapshot', () => {
  test('dispatch is contained: launch_failed + notification recorded, schedule and site_configs rows both untouched', async () => {
    seedUser('user-1');
    const url = 'https://hostile.sentinel.invalid/gallery/1';
    const siteConfigId = await siteConfigManager.createSiteConfig({
      site_pattern: 'hostile.sentinel.invalid',
      display_name: 'Hostile rule (fixture)',
      cli_options: [['option', 'extractor.gdluxx-rem006-sentinel=1']],
      is_default: false,
      enabled: true,
    });
    const beforeSiteConfig = await siteConfigManager.getSiteConfigById(siteConfigId);
    const siteOptionsSnapshot = await buildSiteOptionsSnapshot([url]);

    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        commandSource: { urls: [url], userOptions: [], excludedOptions: [] },
        siteOptionsSnapshot,
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

    const runRow = db.prepare('SELECT error FROM schedule_runs WHERE id = ?').get(run.id) as {
      error: string;
    };
    expect(runRow.error).toMatch(/not permitted/i);

    const stored = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(stored?.commandSource).toEqual(schedule.commandSource);
    expect(stored?.siteOptionsSnapshot).toEqual(schedule.siteOptionsSnapshot);

    expect(await siteConfigManager.getSiteConfigById(siteConfigId)).toEqual(beforeSiteConfig);
  });

  test('regression: a benign site rule carried in siteOptionsSnapshot dispatches normally', async () => {
    seedUser('user-1');
    seedJob('job-benign-site', 'success');
    const url = 'https://benign.sentinel.invalid/gallery/1';
    await siteConfigManager.createSiteConfig({
      site_pattern: 'benign.sentinel.invalid',
      display_name: 'Benign rule (fixture)',
      cli_options: [['verbose', true]],
      is_default: false,
      enabled: true,
    });
    const siteOptionsSnapshot = await buildSiteOptionsSnapshot([url]);

    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        commandSource: { urls: [url], userOptions: [], excludedOptions: [] },
        siteOptionsSnapshot,
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
    executeGalleryDlCommandMock.mockResolvedValueOnce({ success: true, jobId: 'job-benign-site' });

    const { outcome } = await dispatchRun(schedule, run.id, {
      launch: launchUrls,
      getMaxBatchUrls: () => 200,
    });

    expect(outcome).toBe('launched');
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
  });
});
