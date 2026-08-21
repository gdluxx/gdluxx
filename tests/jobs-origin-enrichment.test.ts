/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
// Type-only imports erased at runtime, so they do not defeat the mock below.
import type * as ScheduleManagerShape from '../src/lib/server/schedules/scheduleManager';
import type * as ScheduleRunManagerShape from '../src/lib/server/schedules/scheduleRunManager';
import type * as JobsManagerShape from '../src/lib/server/jobs/jobsManager';

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

vi.mock('$app/environment', () => ({
  dev: false,
  building: false,
  browser: false,
}));

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type ScheduleManagerModule = typeof ScheduleManagerShape;
type ScheduleRunManagerModule = typeof ScheduleRunManagerShape;
type JobsManagerModule = typeof JobsManagerShape;

let scheduleManager: ScheduleManagerModule;
let scheduleRunManager: ScheduleRunManagerModule;
let jobsManager: JobsManagerModule;
let jobsRoute: { GET: (event: never) => Response | Promise<Response> };
let jobsSummaryRoute: { GET: (event: never) => Response | Promise<Response> };

beforeAll(async () => {
  scheduleManager = await import('$lib/server/schedules/scheduleManager');
  scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
  jobsManager = await import('$lib/server/jobs/jobsManager');
  jobsRoute = await import('../src/routes/api/jobs/+server');
  jobsSummaryRoute = await import('../src/routes/api/jobs/summary/+server');
});

/* seeding helpers — FKs are real, so parents must exist first */

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

function scheduleInput(
  overrides: Partial<ScheduleManagerShape.CreateScheduleInput> = {},
): ScheduleManagerShape.CreateScheduleInput {
  return {
    userId: 'owner-1',
    name: 'Nightly Backup',
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

interface OriginEnvelope {
  scheduleId: string | null;
  scheduleName: string;
}

interface JobEnvelopeItem {
  id: string;
  origin?: OriginEnvelope;
}

interface JobsListEnvelope {
  success: boolean;
  data: { jobs: JobEnvelopeItem[]; total: number };
}

interface JobsSummaryEnvelope {
  success: boolean;
  data: { recent: JobEnvelopeItem[] };
}

function jobsRequestEvent(userId: string) {
  return {
    url: new URL('http://localhost/api/jobs'),
    locals: { user: { id: userId, email: `${userId}@example.test` } },
  } as never;
}

function jobsSummaryRequestEvent(userId: string) {
  return {
    locals: { user: { id: userId, email: `${userId}@example.test` } },
  } as never;
}

interface Scenario {
  ownerId: string;
  otherId: string;
  scheduleId: string;
  scheduleName: string;
  scheduledJobId: string;
  unscheduledJobId: string;
}

function seedScheduledJobScenario(): Scenario {
  const ownerId = 'owner-1';
  const otherId = 'other-1';
  seedUser(ownerId);
  seedUser(otherId);

  const scheduledJobId = 'job-scheduled';
  const unscheduledJobId = 'job-unscheduled';
  seedJob(scheduledJobId, 'success');
  seedJob(unscheduledJobId, 'success');

  const schedule = scheduleManager.createSchedule(scheduleInput({ userId: ownerId }));

  const run = scheduleRunManager.createRun({
    scheduleId: schedule.id,
    userId: ownerId,
    scheduleName: schedule.name,
    trigger: 'scheduled',
    outcome: 'launched',
    scheduledFor: SEED_TS,
    urlCount: 1,
    launchedCount: 1,
  });
  scheduleRunManager.addRunJob(run.id, scheduledJobId, 'https://example.test/scheduled-job');

  return {
    ownerId,
    otherId,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scheduledJobId,
    unscheduledJobId,
  };
}

describe('GET /api/jobs — origin enrichment', () => {
  test('the owner sees the schedule link', async () => {
    const scenario = seedScheduledJobScenario();

    const response = await jobsRoute.GET(jobsRequestEvent(scenario.ownerId));
    expect(response.status).toBe(200);
    const body = (await response.json()) as JobsListEnvelope;
    expect(body.success).toBe(true);

    const scheduledJob = body.data.jobs.find((job) => job.id === scenario.scheduledJobId);
    expect(scheduledJob?.origin).toEqual({
      scheduleId: scenario.scheduleId,
      scheduleName: scenario.scheduleName,
    });
  });

  test('a non-owner sees the schedule name but no link', async () => {
    const scenario = seedScheduledJobScenario();

    const response = await jobsRoute.GET(jobsRequestEvent(scenario.otherId));
    const body = (await response.json()) as JobsListEnvelope;

    const scheduledJob = body.data.jobs.find((job) => job.id === scenario.scheduledJobId);
    expect(scheduledJob?.origin).toEqual({
      scheduleId: null,
      scheduleName: scenario.scheduleName,
    });
  });

  test('a job whose schedule was deleted keeps the retained name with no link, for every viewer', async () => {
    const scenario = seedScheduledJobScenario();
    expect(scheduleManager.deleteScheduleForUser(scenario.scheduleId, scenario.ownerId)).toBe(true);

    const ownerResponse = await jobsRoute.GET(jobsRequestEvent(scenario.ownerId));
    const ownerBody = (await ownerResponse.json()) as JobsListEnvelope;
    const ownerView = ownerBody.data.jobs.find((job) => job.id === scenario.scheduledJobId);
    expect(ownerView?.origin).toEqual({ scheduleId: null, scheduleName: scenario.scheduleName });

    const otherResponse = await jobsRoute.GET(jobsRequestEvent(scenario.otherId));
    const otherBody = (await otherResponse.json()) as JobsListEnvelope;
    const otherView = otherBody.data.jobs.find((job) => job.id === scenario.scheduledJobId);
    expect(otherView?.origin).toEqual({ scheduleId: null, scheduleName: scenario.scheduleName });
  });

  test('an unscheduled job carries no origin key at all', async () => {
    const scenario = seedScheduledJobScenario();

    const response = await jobsRoute.GET(jobsRequestEvent(scenario.ownerId));
    const body = (await response.json()) as JobsListEnvelope;

    const unscheduledJob = body.data.jobs.find((job) => job.id === scenario.unscheduledJobId);
    expect(unscheduledJob).toBeDefined();
    expect('origin' in (unscheduledJob as JobEnvelopeItem)).toBe(false);
  });
});

describe('GET /api/jobs/summary — origin enrichment', () => {
  test('recent jobs are enriched the same way as the list endpoint', async () => {
    const scenario = seedScheduledJobScenario();

    const response = await jobsSummaryRoute.GET(jobsSummaryRequestEvent(scenario.otherId));
    expect(response.status).toBe(200);
    const body = (await response.json()) as JobsSummaryEnvelope;

    const scheduledJob = body.data.recent.find((job) => job.id === scenario.scheduledJobId);
    expect(scheduledJob?.origin).toEqual({
      scheduleId: null,
      scheduleName: scenario.scheduleName,
    });

    const unscheduledJob = body.data.recent.find((job) => job.id === scenario.unscheduledJobId);
    expect('origin' in (unscheduledJob as JobEnvelopeItem)).toBe(false);
  });
});

describe('extension contract pin', () => {
  test('readJobsByIds output never carries an origin key, even for a job with a live schedule link', () => {
    const scenario = seedScheduledJobScenario();

    const [result] = jobsManager.readJobsByIds([scenario.scheduledJobId]);
    expect(result).toBeDefined();
    expect('origin' in (result as JobEnvelopeItem)).toBe(false);
  });
});
