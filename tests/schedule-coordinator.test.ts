/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
// Type-only imports are erased at runtime, so they do not defeat the mocks below.
import type { Scheduler, SchedulerDeps } from '../src/lib/server/schedules/coordinator';
import type { CreateScheduleInput } from '../src/lib/server/schedules/scheduleManager';
import type { LaunchRequest, LaunchResult } from '../src/lib/server/jobs/commandLauncher';

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

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// commandLauncher -> commandExecutor pulls in the pty binding and the jobManager
// singleton; the coordinator never reaches the executor because `launch` is a dep.
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: vi.fn(),
  executeGalleryDlBatchCommand: vi.fn(),
}));

const { createScheduler, MISFIRE_GRACE_MS, MAX_MISSED_PER_SCAN } =
  await import('$lib/server/schedules/coordinator');
const scheduleManager = await import('$lib/server/schedules/scheduleManager');
const scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
const scheduleNotificationManager =
  await import('$lib/server/schedules/scheduleNotificationManager');
const { BinaryUnavailableError } = await import('$lib/server/jobs/commandLauncher');

const SEED_TS = 1_700_000_000_000;
const USER_ID = 'user-1';
const URL_A = 'https://example.test/a';
const URL_B = 'https://example.test/b';

/** Daily 09:00 UTC anchored at 2026-01-01; `slot(n)` is the nth day's instant. */
function slot(day: number): number {
  return Date.UTC(2026, 0, day, 9, 0, 0);
}

const INTERVAL_STEP_MS = 5 * 60_000;
const INTERVAL_START = Date.UTC(2026, 0, 1, 0, 0, 0);

function intervalSlot(index: number): number {
  return INTERVAL_START + index * INTERVAL_STEP_MS;
}

interface RunRow {
  id: string;
  scheduleId: string | null;
  userId: string;
  scheduleName: string;
  trigger: string;
  outcome: string;
  scheduledFor: number;
  urlCount: number;
  launchedCount: number;
  missedFrom: number | null;
  missedTo: number | null;
  missedCount: number | null;
  truncated: number;
  error: string | null;
}

interface NotificationRow {
  id: string;
  scheduleId: string | null;
  scheduleName: string;
  runId: string | null;
  type: string;
  occurrenceCount: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  acknowledgedAt: number | null;
}

function readRuns(): RunRow[] {
  return db.prepare('SELECT * FROM schedule_runs ORDER BY rowid').all() as RunRow[];
}

function readNotifications(): NotificationRow[] {
  return db
    .prepare('SELECT * FROM schedule_notifications ORDER BY rowid')
    .all() as NotificationRow[];
}

function readLinkedJobIds(runId: string): string[] {
  const rows = db
    .prepare('SELECT jobId FROM schedule_run_jobs WHERE runId = ? ORDER BY rowid')
    .all(runId) as Array<{ jobId: string }>;
  return rows.map((row) => row.jobId);
}

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

function makeSchedule(overrides: Partial<CreateScheduleInput> = {}) {
  return scheduleManager.createSchedule({
    userId: USER_ID,
    name: 'Nightly',
    status: 'active',
    timezone: 'UTC',
    recurrence: { kind: 'daily', time: '09:00' },
    startDate: '2026-01-01',
    endDate: null,
    misfirePolicy: 'skip',
    commandSource: { urls: [URL_A], userOptions: [], excludedOptions: [] },
    siteOptionsSnapshot: {},
    nextOccurrenceAt: slot(1),
    ...overrides,
  });
}

let fakeNow = 0;
let jobCounter = 0;
let consoleError: ReturnType<typeof vi.spyOn>;

/** Mimics launchUrls' contract: sequential per-URL results, `onLaunched` per settle. */
function fakeLaunch(outcomes: Array<'ok' | 'fail'> = []) {
  return vi.fn(async (request: LaunchRequest): Promise<LaunchResult[]> => {
    const results: LaunchResult[] = [];
    request.urls.forEach((url, index) => {
      let result: LaunchResult;
      if ((outcomes[index] ?? 'ok') === 'ok') {
        const jobId = `job-${++jobCounter}`;
        seedJob(jobId, 'success');
        result = { url, success: true, jobId };
      } else {
        result = { url, success: false, error: 'spawn failed' };
      }
      results.push(result);
      request.onLaunched?.(result);
    });
    return results;
  });
}

let launchMock = fakeLaunch();

function createTestScheduler(overrides: Partial<SchedulerDeps> = {}): Scheduler {
  return createScheduler({
    now: () => fakeNow,
    whenReady: () => Promise.resolve(),
    launch: launchMock,
    getMaxBatchUrls: () => 200,
    processStartMs: SEED_TS,
    ...overrides,
  });
}

beforeEach(() => {
  jobCounter = 0;
  launchMock = fakeLaunch();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  seedUser(USER_ID);
});

afterEach(() => {
  // Every case must leave the shared connection with no open transaction.
  expect(db.inTransaction).toBe(false);
  consoleError.mockRestore();
  db.exec(`
    DELETE FROM schedule_notifications;
    DELETE FROM schedule_run_jobs;
    DELETE FROM schedule_runs;
    DELETE FROM schedules;
    DELETE FROM jobs;
    DELETE FROM user;
  `);
});

describe('module shape', () => {
  test('importing the coordinator arms no timer and writes nothing', async () => {
    vi.resetModules();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const freshModule = await import('$lib/server/schedules/coordinator');

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(typeof freshModule.createScheduler).toBe('function');
    expect(readRuns()).toHaveLength(0);
    expect(readNotifications()).toHaveLength(0);

    setTimeoutSpy.mockRestore();
  });
});

describe('on-time dispatch', () => {
  test('claims the slot, dispatches, links jobs and advances the schedule', async () => {
    const schedule = makeSchedule({
      siteOptionsSnapshot: { [URL_A]: [['username', 'site-user']] },
      commandSource: {
        urls: [URL_A],
        userOptions: [['simulate', true]],
        excludedOptions: ['cookies'],
      },
    });
    fakeNow = slot(1) + 1000;

    await createTestScheduler().runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    const request = launchMock.mock.calls[0][0];
    expect(request.urls).toEqual([URL_A]);
    expect(request.args).toEqual([['simulate', true]]);
    expect(request.excludedOptions).toEqual(['cookies']);
    await expect(request.resolveSiteOptions(URL_A)).resolves.toEqual([['username', 'site-user']]);
    await expect(request.resolveSiteOptions('https://unknown.test')).resolves.toEqual([]);

    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      scheduleId: schedule.id,
      userId: USER_ID,
      scheduleName: 'Nightly',
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: slot(1),
      urlCount: 1,
      launchedCount: 1,
      missedFrom: null,
      missedTo: null,
      missedCount: null,
      truncated: 0,
    });
    expect(readLinkedJobIds(runs[0].id)).toEqual(['job-1']);

    const advanced = scheduleManager.readScheduleForUser(schedule.id, USER_ID);
    expect(advanced?.nextOccurrenceAt).toBe(slot(2));
    expect(advanced?.lastOccurrenceAt).toBe(slot(1));
    expect(advanced?.status).toBe('active');
    expect(readNotifications()).toHaveLength(0);
  });

  test('a slot exactly MISFIRE_GRACE_MS old is still on time', async () => {
    makeSchedule();
    fakeNow = slot(1) + MISFIRE_GRACE_MS;

    await createTestScheduler().runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(readRuns()[0]).toMatchObject({ trigger: 'scheduled', outcome: 'launched' });
  });

  test('one millisecond past the grace window is a misfire, not a dispatch', async () => {
    makeSchedule();
    fakeNow = slot(1) + MISFIRE_GRACE_MS + 1;

    await createTestScheduler().runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    expect(readRuns()[0]).toMatchObject({ outcome: 'skipped_misfire', scheduledFor: slot(1) });
  });

  test('a schedule whose next occurrence is still in the future is not read as due', async () => {
    makeSchedule({ startDate: '2020-01-01', nextOccurrenceAt: slot(1) });
    fakeNow = slot(1) - 1000;

    await createTestScheduler().runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    expect(readRuns()).toHaveLength(0);
    expect(readNotifications()).toHaveLength(0);
  });
});

describe('classification B — on-time slot alongside stale slots', () => {
  test('skip: the current slot dispatches and the stale window gets its own terminal run', async () => {
    const schedule = makeSchedule({ misfirePolicy: 'skip' });
    fakeNow = slot(3) + 1000;

    await createTestScheduler().runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    const runs = readRuns();
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      trigger: 'scheduled',
      outcome: 'skipped_misfire',
      scheduledFor: slot(2),
      missedFrom: slot(1),
      missedTo: slot(2),
      missedCount: 2,
      truncated: 0,
    });
    expect(runs[1]).toMatchObject({
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: slot(3),
      missedFrom: null,
      missedCount: null,
    });

    const notifications = readNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: 'missed_skipped',
      scheduleId: schedule.id,
      occurrenceCount: 1,
      rangeStart: slot(1),
      rangeEnd: slot(2),
      acknowledgedAt: null,
    });
  });

  test('catch_up: a single dispatch carries the stale window and an unread notification', async () => {
    makeSchedule({ misfirePolicy: 'catch_up' });
    fakeNow = slot(3) + 1000;

    await createTestScheduler().runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: slot(3),
      missedFrom: slot(1),
      missedTo: slot(2),
      missedCount: 2,
      truncated: 0,
    });

    const notifications = readNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: 'missed_caught_up',
      rangeStart: slot(1),
      rangeEnd: slot(2),
      acknowledgedAt: null,
    });
    expect(scheduleNotificationManager.countUnreadForUser(USER_ID)).toBe(1);
  });
});

describe('classification C — every due slot missed', () => {
  test('skip: one terminal misfire run over the whole window and nothing launched', async () => {
    const schedule = makeSchedule({ misfirePolicy: 'skip' });
    fakeNow = slot(3) + MISFIRE_GRACE_MS + 1;

    await createTestScheduler().runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      trigger: 'scheduled',
      outcome: 'skipped_misfire',
      scheduledFor: slot(3),
      missedFrom: slot(1),
      missedTo: slot(3),
      missedCount: 3,
      launchedCount: 0,
    });
    expect(readNotifications()[0]).toMatchObject({
      type: 'missed_skipped',
      rangeStart: slot(1),
      rangeEnd: slot(3),
    });

    const advanced = scheduleManager.readScheduleForUser(schedule.id, USER_ID);
    expect(advanced?.lastOccurrenceAt).toBe(slot(3));
    expect(advanced?.nextOccurrenceAt).toBe(slot(4));
  });

  test('catch_up: exactly one catch_up dispatch carrying the whole window', async () => {
    makeSchedule({ misfirePolicy: 'catch_up' });
    fakeNow = slot(3) + MISFIRE_GRACE_MS + 1;

    await createTestScheduler().runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      trigger: 'catch_up',
      outcome: 'launched',
      scheduledFor: slot(3),
      missedFrom: slot(1),
      missedTo: slot(3),
      missedCount: 3,
    });
    expect(readNotifications()[0]).toMatchObject({
      type: 'missed_caught_up',
      acknowledgedAt: null,
    });
  });
});

describe('misfire cap truncation', () => {
  const truncationOverrides: Partial<CreateScheduleInput> = {
    recurrence: { kind: 'interval', time: '00:00', unit: 'minutes', every: 5 },
    nextOccurrenceAt: INTERVAL_START,
  };

  test('skip: the window is capped at [first, now], nothing dispatches, the advance clears the backlog', async () => {
    const schedule = makeSchedule({ ...truncationOverrides, misfirePolicy: 'skip' });
    fakeNow = intervalSlot(1500);

    await createTestScheduler().runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      outcome: 'skipped_misfire',
      scheduledFor: intervalSlot(MAX_MISSED_PER_SCAN - 1),
      missedFrom: INTERVAL_START,
      missedTo: fakeNow,
      missedCount: MAX_MISSED_PER_SCAN,
      truncated: 1,
    });

    const advanced = scheduleManager.readScheduleForUser(schedule.id, USER_ID);
    expect(advanced?.lastOccurrenceAt).toBe(intervalSlot(MAX_MISSED_PER_SCAN - 1));
    expect(advanced?.nextOccurrenceAt).toBe(intervalSlot(1501));
  });

  test('catch_up: one dispatch flagged truncated (product decision: always exactly one recovery dispatch)', async () => {
    makeSchedule({ ...truncationOverrides, misfirePolicy: 'catch_up' });
    fakeNow = intervalSlot(1500);

    await createTestScheduler().runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(readRuns()[0]).toMatchObject({
      trigger: 'catch_up',
      outcome: 'launched',
      truncated: 1,
      missedCount: MAX_MISSED_PER_SCAN,
    });
  });
});

describe('overlap', () => {
  function seedRunningLinkedJob(scheduleId: string): void {
    const priorRun = scheduleRunManager.createRun({
      scheduleId,
      userId: USER_ID,
      scheduleName: 'Nightly',
      trigger: 'manual',
      outcome: 'launched',
      scheduledFor: slot(1) - 1,
      urlCount: 1,
      launchedCount: 1,
    });
    seedJob('job-running', 'running');
    scheduleRunManager.addRunJob(priorRun.id, 'job-running', URL_A);
  }

  test('a blocked dispatch becomes skipped_overlap, and the misfire record is written first', async () => {
    const schedule = makeSchedule({ misfirePolicy: 'skip' });
    seedRunningLinkedJob(schedule.id);
    fakeNow = slot(3) + 1000;

    await createTestScheduler().runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    const runs = readRuns().filter((run) => run.trigger === 'scheduled');
    expect(runs.map((run) => run.outcome)).toEqual(['skipped_misfire', 'skipped_overlap']);
    expect(runs[1]).toMatchObject({ scheduledFor: slot(3), urlCount: 1, launchedCount: 0 });

    const notifications = readNotifications();
    expect(notifications.map((notification) => notification.type)).toEqual([
      'missed_skipped',
      'overlap_skipped',
    ]);
    expect(notifications[1]).toMatchObject({
      rangeStart: slot(3),
      rangeEnd: slot(3),
      occurrenceCount: 1,
    });
  });

  test('repeated overlaps coalesce into one unacknowledged notification with a growing count', async () => {
    const schedule = makeSchedule();
    seedRunningLinkedJob(schedule.id);
    const scheduler = createTestScheduler();

    fakeNow = slot(1) + 1000;
    await scheduler.runScanOnce();
    fakeNow = slot(2) + 1000;
    await scheduler.runScanOnce();

    const overlapRuns = readRuns().filter((run) => run.outcome === 'skipped_overlap');
    expect(overlapRuns.map((run) => run.scheduledFor)).toEqual([slot(1), slot(2)]);

    const notifications = readNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: 'overlap_skipped',
      occurrenceCount: 2,
      rangeStart: slot(1),
      rangeEnd: slot(2),
    });
    expect(launchMock).not.toHaveBeenCalled();
  });
});

describe('dispatch failures', () => {
  test('BinaryUnavailableError finalizes the run launch_failed and notifies', async () => {
    makeSchedule();
    launchMock = vi.fn(async () => {
      throw new BinaryUnavailableError('gallery-dl.bin not found or not executable');
    });
    fakeNow = slot(1) + 1000;

    await createTestScheduler().runScanOnce();

    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      outcome: 'launch_failed',
      launchedCount: 0,
      error: 'gallery-dl.bin not found or not executable',
    });
    expect(readNotifications()[0]).toMatchObject({
      type: 'launch_failed',
      runId: runs[0].id,
      acknowledgedAt: null,
    });
  });

  test('a maxBatchUrls recheck failure launches nothing and never truncates the URL list', async () => {
    makeSchedule({
      commandSource: { urls: [URL_A, URL_B], userOptions: [], excludedOptions: [] },
    });
    fakeNow = slot(1) + 1000;

    await createTestScheduler({ getMaxBatchUrls: () => 1 }).runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    const runs = readRuns();
    expect(runs[0]).toMatchObject({ outcome: 'launch_failed', urlCount: 2, launchedCount: 0 });
    expect(runs[0].error).toContain('batch limit');
    expect(readNotifications()[0]).toMatchObject({ type: 'launch_failed' });
  });

  test('a partial launch links the successful URL, records partial and notifies', async () => {
    makeSchedule({
      commandSource: { urls: [URL_A, URL_B], userOptions: [], excludedOptions: [] },
    });
    launchMock = fakeLaunch(['ok', 'fail']);
    fakeNow = slot(1) + 1000;

    await createTestScheduler().runScanOnce();

    const runs = readRuns();
    expect(runs[0]).toMatchObject({
      outcome: 'partial',
      urlCount: 2,
      launchedCount: 1,
      error: 'spawn failed',
    });
    expect(readLinkedJobIds(runs[0].id)).toEqual(['job-1']);
    expect(readNotifications()[0]).toMatchObject({ type: 'launch_failed' });
  });
});

describe('completion', () => {
  test('a once schedule completes after its dispatch', async () => {
    const schedule = makeSchedule({ recurrence: { kind: 'once', time: '09:00' } });
    fakeNow = slot(1) + 1000;

    await createTestScheduler().runScanOnce();

    const completed = scheduleManager.readScheduleForUser(schedule.id, USER_ID);
    expect(completed?.status).toBe('completed');
    expect(completed?.nextOccurrenceAt).toBeNull();
    expect(completed?.lastOccurrenceAt).toBe(slot(1));
    expect(readRuns()[0]).toMatchObject({ outcome: 'launched' });
  });

  test('a once schedule missed under skip completes with a skipped_misfire run', async () => {
    const schedule = makeSchedule({
      recurrence: { kind: 'once', time: '09:00' },
      misfirePolicy: 'skip',
    });
    fakeNow = slot(1) + MISFIRE_GRACE_MS + 1;

    await createTestScheduler().runScanOnce();

    expect(launchMock).not.toHaveBeenCalled();
    expect(readRuns()[0]).toMatchObject({ outcome: 'skipped_misfire', scheduledFor: slot(1) });
    expect(readNotifications()[0]).toMatchObject({ type: 'missed_skipped' });

    const completed = scheduleManager.readScheduleForUser(schedule.id, USER_ID);
    expect(completed?.status).toBe('completed');
    expect(completed?.nextOccurrenceAt).toBeNull();
  });

  test('a schedule completes when the next occurrence would fall past its end date', async () => {
    const schedule = makeSchedule({ endDate: '2026-01-02', nextOccurrenceAt: slot(2) });
    fakeNow = slot(2) + 1000;

    await createTestScheduler().runScanOnce();

    expect(readRuns()[0]).toMatchObject({ outcome: 'launched', scheduledFor: slot(2) });
    const completed = scheduleManager.readScheduleForUser(schedule.id, USER_ID);
    expect(completed?.status).toBe('completed');
    expect(completed?.nextOccurrenceAt).toBeNull();
  });

  test('a completed schedule is never picked up again', async () => {
    const schedule = makeSchedule({ recurrence: { kind: 'once', time: '09:00' } });
    const scheduler = createTestScheduler();

    fakeNow = slot(1) + 1000;
    await scheduler.runScanOnce();
    fakeNow = slot(5);
    await scheduler.runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(readRuns()).toHaveLength(1);
    expect(scheduleManager.readScheduleForUser(schedule.id, USER_ID)?.status).toBe('completed');
  });
});

describe('pause and resume', () => {
  test('a paused window produces no runs and no misfire on resume', async () => {
    const schedule = makeSchedule({ misfirePolicy: 'skip' });
    const scheduler = createTestScheduler();

    scheduleManager.setScheduleStatus(schedule.id, USER_ID, {
      status: 'paused',
      nextOccurrenceAt: null,
    });

    fakeNow = slot(4) + 1000;
    await scheduler.runScanOnce();
    expect(readRuns()).toHaveLength(0);
    expect(readNotifications()).toHaveLength(0);

    scheduleManager.setScheduleStatus(schedule.id, USER_ID, {
      status: 'active',
      nextOccurrenceAt: slot(5),
    });

    fakeNow = slot(5) + 1000;
    await scheduler.runScanOnce();

    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ outcome: 'launched', scheduledFor: slot(5) });
    expect(readNotifications()).toHaveLength(0);
  });
});

describe('claim safety', () => {
  test('a concurrent edit between read and claim aborts the claim silently', async () => {
    const first = makeSchedule({ name: 'First' });
    const second = makeSchedule({ name: 'Second' });

    launchMock = vi.fn(async (request: LaunchRequest): Promise<LaunchResult[]> => {
      db.prepare('UPDATE schedules SET nextOccurrenceAt = ? WHERE id = ?').run(slot(9), second.id);
      const jobId = `job-${++jobCounter}`;
      seedJob(jobId, 'success');
      const result: LaunchResult = { url: request.urls[0], success: true, jobId };
      request.onLaunched?.(result);
      return [result];
    });

    fakeNow = slot(1) + 1000;
    await createTestScheduler().runScanOnce();

    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].scheduleId).toBe(first.id);
    expect(readNotifications()).toHaveLength(0);
    expect(consoleError).not.toHaveBeenCalled();

    const untouched = scheduleManager.readScheduleForUser(second.id, USER_ID);
    expect(untouched?.nextOccurrenceAt).toBe(slot(9));
    expect(untouched?.lastOccurrenceAt).toBeNull();
  });

  test('a second scan at the same instant claims nothing twice', async () => {
    makeSchedule();
    const scheduler = createTestScheduler();
    fakeNow = slot(1) + 1000;

    await scheduler.runScanOnce();
    await scheduler.runScanOnce();

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(readRuns()).toHaveLength(1);
  });

  test('a schedule that throws mid-processing does not abort the tick for the rest', async () => {
    makeSchedule({ name: 'Corrupt', timezone: 'Not/AZone' });
    const healthy = makeSchedule({ name: 'Healthy' });
    fakeNow = slot(1) + 1000;

    await createTestScheduler().runScanOnce();

    expect(consoleError).toHaveBeenCalled();
    const runs = readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ scheduleId: healthy.id, outcome: 'launched' });
    expect(launchMock).toHaveBeenCalledTimes(1);
  });
});

describe('start()', () => {
  function seedStaleDispatchingRun(scheduleId: string): string {
    const run = scheduleRunManager.createRun({
      scheduleId,
      userId: USER_ID,
      scheduleName: 'Nightly',
      trigger: 'scheduled',
      outcome: 'dispatching',
      // An earlier slot than any the scan will claim: the partial unique index
      // rejects a second scheduled/catch_up run on the same (schedule, slot).
      scheduledFor: slot(1) - 86_400_000,
      urlCount: 2,
    });
    db.prepare('UPDATE schedule_runs SET createdAt = ? WHERE id = ?').run(1000, run.id);
    return run.id;
  }

  test('a stale claim with linked jobs is finalized partial and never re-dispatched', async () => {
    const schedule = makeSchedule({ nextOccurrenceAt: slot(9) });
    const runId = seedStaleDispatchingRun(schedule.id);
    seedJob('job-linked', 'success');
    scheduleRunManager.addRunJob(runId, 'job-linked', URL_A);

    fakeNow = slot(1);
    const scheduler = createTestScheduler();
    await scheduler.start();
    scheduler.stop();

    expect(readRuns()[0]).toMatchObject({ id: runId, outcome: 'partial', launchedCount: 1 });
    expect(readNotifications()).toHaveLength(0);
    expect(launchMock).not.toHaveBeenCalled();
  });

  test('a stale claim with no linked jobs is finalized launch_failed with a notification', async () => {
    const schedule = makeSchedule({ nextOccurrenceAt: slot(9) });
    const runId = seedStaleDispatchingRun(schedule.id);

    fakeNow = slot(1);
    const scheduler = createTestScheduler();
    await scheduler.start();
    scheduler.stop();

    expect(readRuns()[0]).toMatchObject({ id: runId, outcome: 'launch_failed', launchedCount: 0 });
    expect(readNotifications()[0]).toMatchObject({
      type: 'launch_failed',
      runId,
      acknowledgedAt: null,
    });
    expect(launchMock).not.toHaveBeenCalled();
  });

  test('reconciliation runs before the first scan, which then dispatches due work', async () => {
    const schedule = makeSchedule();
    const runId = seedStaleDispatchingRun(schedule.id);

    fakeNow = slot(1) + 1000;
    const scheduler = createTestScheduler();
    await scheduler.start();
    scheduler.stop();

    const runs = readRuns();
    expect(runs[0]).toMatchObject({ id: runId, outcome: 'launch_failed' });
    expect(runs[1]).toMatchObject({ outcome: 'launched', scheduledFor: slot(1) });
    expect(launchMock).toHaveBeenCalledTimes(1);
  });

  test('a rejected whenReady propagates and nothing is scanned', async () => {
    makeSchedule();
    fakeNow = slot(1) + 1000;
    const scheduler = createTestScheduler({
      whenReady: () => Promise.reject(new Error('jobs subsystem failed')),
    });

    await expect(scheduler.start()).rejects.toThrow('jobs subsystem failed');
    scheduler.stop();

    expect(readRuns()).toHaveLength(0);
    expect(launchMock).not.toHaveBeenCalled();
  });
});
