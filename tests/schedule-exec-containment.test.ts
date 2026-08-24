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
 * `test.fails` cases define pending containment for gallery-dl argv options
 * that inject runtime configuration through scheduled dispatch.
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

// launchUrls runs real in these tests; its binary probe must not depend on
// data/gallery-dl.bin existing on whatever machine runs the suite.
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

// Mocking one level below commandLauncher keeps the real launchUrls,
// validateAndBuildCliArgs, and dispatchRun under test.
const executeGalleryDlCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
  executeGalleryDlBatchCommand: vi.fn(),
}));

const scheduleManager = await import('$lib/server/schedules/scheduleManager');
const scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
const { dispatchRun } = await import('$lib/server/schedules/dispatchRun');
const { launchUrls } = await import('$lib/server/jobs/commandLauncher');
const { validateAndBuildCliArgs } = await import('$lib/server/validation/option-validation');

const SEED_TS = 1_700_000_000_000;

function seedUser(id: string): void {
  db.prepare('INSERT INTO user (id, email, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(
    id,
    `${id}@example.test`,
    SEED_TS,
    SEED_TS,
  );
}

function seedJob(id: string, status: 'running' | 'success' | 'no_action' | 'error'): void {
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
  executeGalleryDlCommandMock.mockReset();
  executeGalleryDlCommandMock.mockResolvedValue({ success: true, jobId: 'unused' });
});

afterEach(() => {
  db.exec(`
    DELETE FROM schedule_notifications;
    DELETE FROM schedule_run_jobs;
    DELETE FROM schedule_runs;
    DELETE FROM schedules;
    DELETE FROM jobs;
    DELETE FROM user;
  `);
});

describe('validateAndBuildCliArgs: gallery-dl argv config injection [REM-006]', () => {
  test.fails(
    'REM-006: option/postprocessor/postprocessor-option are neutralized, not emitted as CLI flags [flip to test() when REM-006 lands]',
    () => {
      // REM-006 may neutralize by throwing (reject) or by dropping the ids;
      // both are secure, so a throw here is a pass, not a masked failure.
      let args: string[];
      try {
        args = validateAndBuildCliArgs(
          new Map<string, unknown>([
            ['option', 'extractor.base-directory=/tmp/pwned'],
            ['postprocessor', 'exec'],
            ['postprocessor-option', 'exec.command=touch /tmp/pwned'],
          ]),
        );
      } catch {
        return;
      }

      expect(args).not.toContain('--option');
      expect(args).not.toContain('--postprocessor');
      expect(args).not.toContain('--postprocessor-option');
    },
  );
});

describe('dispatchRun: stored schedule execution containment [REM-006]', () => {
  test.fails(
    'REM-006: a stored schedule with hostile userOptions does not reach spawn with unsafe flags [flip to test() when REM-006 lands]',
    async () => {
      seedUser('user-1');
      seedJob('job-hostile', 'success');
      const schedule = scheduleManager.createSchedule(
        scheduleInput({
          commandSource: {
            urls: ['https://example.test/a'],
            userOptions: [
              ['option', 'extractor.base-directory=/tmp/pwned'],
              ['postprocessor', 'exec'],
            ],
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
      executeGalleryDlCommandMock.mockResolvedValueOnce({ success: true, jobId: 'job-hostile' });

      await dispatchRun(schedule, run.id, { launch: launchUrls, getMaxBatchUrls: () => 200 });

      const unsafeCall = executeGalleryDlCommandMock.mock.calls.find(([, cliArgs]) =>
        (cliArgs as string[]).some((flag) =>
          ['--option', '--postprocessor', '--postprocessor-option'].includes(flag),
        ),
      );
      expect(unsafeCall).toBeUndefined();
    },
  );

  test('regression: a schedule with only benign userOptions dispatches and invokes executeGalleryDlCommand', async () => {
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

    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('launched');
  });
});
