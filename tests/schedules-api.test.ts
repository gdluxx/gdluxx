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
import type { RequestHandler } from '@sveltejs/kit';
import type { CreateScheduleInput } from '../src/lib/server/schedules/scheduleManager';
import { MAX_SCHEDULES_PER_USER } from '../src/lib/server/validation/schedules-validation';

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

// api-utils.ts imports `dev` from $app/environment, unavailable outside SvelteKit.
vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

// launchUrls runs real in the /run tests; its binary probe must not depend on
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

const getUserSettingsMock = vi.fn((_userId: string) => ({
  warnOnSiteRuleOverride: false,
  selectedTheme: 'indigo' as const,
  maxBatchUrls: 200,
}));
vi.mock('$lib/server/userSettingsManager', () => ({
  userSettingsManager: { getUserSettings: (userId: string) => getUserSettingsMock(userId) },
}));

const getCliOptionsForUrlMock = vi.fn(
  async (_url: string) => [] as Array<[string, string | number | boolean]>,
);
vi.mock('$lib/server/siteConfigManager', () => ({
  siteConfigManager: { getCliOptionsForUrl: (url: string) => getCliOptionsForUrlMock(url) },
}));

// commandLauncher -> commandExecutor pulls in the pty binding and the
// jobManager singleton; mocking one level below commandLauncher keeps the
// real launchUrls (and BinaryUnavailableError) in the /run route under test.
const executeGalleryDlCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
  executeGalleryDlBatchCommand: vi.fn(),
}));

const scheduleManager = await import('$lib/server/schedules/scheduleManager');
const scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
const scheduleNotificationManager =
  await import('$lib/server/schedules/scheduleNotificationManager');
const { PROCESS_START_MS } = await import('$lib/server/schedules/dispatchRun');

const { GET: listSchedules, POST: postSchedule } =
  await import('../src/routes/api/schedules/+server');
const {
  GET: getSchedule,
  PUT: putSchedule,
  DELETE: deleteSchedule,
} = await import('../src/routes/api/schedules/[scheduleId]/+server');
const { POST: postStatus } =
  await import('../src/routes/api/schedules/[scheduleId]/status/+server');
const { POST: postRun } = await import('../src/routes/api/schedules/[scheduleId]/run/+server');
const { GET: getRuns } = await import('../src/routes/api/schedules/[scheduleId]/runs/+server');
const { POST: postPreview } = await import('../src/routes/api/schedules/preview/+server');
const { GET: listNotifications, DELETE: deleteNotifications } =
  await import('../src/routes/api/schedule-notifications/+server');
const { GET: notificationsSummary } =
  await import('../src/routes/api/schedule-notifications/summary/+server');
const { POST: acknowledgeNotification } =
  await import('../src/routes/api/schedule-notifications/[notificationId]/acknowledge/+server');

interface StubEventInit {
  request?: Request;
  user?: { id: string };
  params?: Record<string, string>;
  url?: URL;
}

function stubEvent(init: StubEventInit = {}): Parameters<RequestHandler>[0] {
  const url = init.url ?? new URL(init.request?.url ?? 'http://localhost/');
  const shaped: {
    request: Request;
    locals: { user?: { id: string } };
    params: Record<string, string>;
    url: URL;
  } = {
    request: init.request ?? new Request(url),
    locals: { user: init.user },
    params: init.params ?? {},
    url,
  };
  return shaped as Parameters<RequestHandler>[0];
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

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

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My schedule',
    timezone: 'UTC',
    recurrence: { kind: 'daily', time: '09:00' },
    startDate: '2026-01-01',
    misfirePolicy: 'skip',
    commandSource: {
      urls: ['https://example.test/a'],
      userOptions: [],
      excludedOptions: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  getUserSettingsMock.mockReset();
  getUserSettingsMock.mockImplementation(() => ({
    warnOnSiteRuleOverride: false,
    selectedTheme: 'indigo',
    maxBatchUrls: 200,
  }));
  getCliOptionsForUrlMock.mockReset();
  getCliOptionsForUrlMock.mockResolvedValue([]);
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

describe('GET/POST /api/schedules', () => {
  test('GET returns owner-scoped summaries: no commandSource, no raw recurrence, no-store', async () => {
    seedUser('user-1');
    seedUser('user-2');
    scheduleManager.createSchedule(scheduleInput({ userId: 'user-1', name: 'mine' }));
    scheduleManager.createSchedule(scheduleInput({ userId: 'user-2', name: 'theirs' }));

    const response = await listSchedules(stubEvent({ user: { id: 'user-1' } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    const envelope = await readEnvelope<Array<Record<string, unknown>>>(response);
    expect(envelope.success).toBe(true);
    expect(typeof envelope.timestamp).toBe('string');
    expect(envelope.data).toHaveLength(1);
    const [row] = envelope.data as Array<Record<string, unknown>>;
    expect(row.name).toBe('mine');
    expect(row).not.toHaveProperty('commandSource');
    expect(row).not.toHaveProperty('recurrence');
    expect(row.recurrenceSummary).toBe('Daily at 09:00');
    expect(row.latestRun).toBeNull();
  });

  test('GET envelope shape on an error path', async () => {
    // requires a session; no user in locals mirrors what an unauthenticated
    // request would look like if it ever reached the handler.
    const response = await listSchedules(stubEvent({}));
    expect(response.status).toBe(401);
    const envelope = await readEnvelope<never>(response);
    expect(envelope.success).toBe(false);
    expect(typeof envelope.error).toBe('string');
    expect(typeof envelope.timestamp).toBe('string');
  });

  test('POST creates a schedule and returns masked detail covering commandSource AND siteOptionsSnapshot', async () => {
    seedUser('user-1');
    getCliOptionsForUrlMock.mockResolvedValueOnce([
      ['cookies', '/data/cookies.txt'],
      ['filename', 'site-name'],
    ]);

    const response = await postSchedule(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest(
          'http://localhost/api/schedules',
          'POST',
          createPayload({
            commandSource: {
              urls: ['https://example.test/a'],
              userOptions: [['password', 'secret-value']],
              excludedOptions: [],
            },
          }),
        ),
      }),
    );

    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{
      commandSource: { userOptions: unknown[] };
      siteOptionsSnapshot: Record<string, unknown[]>;
    }>(response);
    expect(envelope.data?.commandSource.userOptions).toEqual([
      ['password', { sensitive: true, hasValue: true }],
    ]);
    expect(envelope.data?.siteOptionsSnapshot['https://example.test/a']).toEqual([
      ['cookies', { sensitive: true, hasValue: true }],
      ['filename', 'site-name'],
    ]);
  });

  test('POST 400s on an invalid payload', async () => {
    seedUser('user-1');
    const response = await postSchedule(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedules', 'POST', createPayload({ name: '' })),
      }),
    );
    expect(response.status).toBe(400);
  });

  test('POST 400s when a "once" start is already in the past', async () => {
    seedUser('user-1');
    const response = await postSchedule(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest(
          'http://localhost/api/schedules',
          'POST',
          createPayload({ recurrence: { kind: 'once', time: '00:00' }, startDate: '2020-01-01' }),
        ),
      }),
    );
    expect(response.status).toBe(400);
    const envelope = await readEnvelope<never>(response);
    expect(envelope.error).toContain('start is in the past');
  });

  test(`POST 400s at the ${MAX_SCHEDULES_PER_USER}-schedule per-user cap`, async () => {
    seedUser('user-1');
    for (let i = 0; i < MAX_SCHEDULES_PER_USER; i++) {
      scheduleManager.createSchedule(scheduleInput({ name: `schedule-${i}` }));
    }

    const response = await postSchedule(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedules', 'POST', createPayload()),
      }),
    );
    expect(response.status).toBe(400);
  });

  test("POST 400s when URLs exceed the owner's maxBatchUrls", async () => {
    seedUser('user-1');
    getUserSettingsMock.mockImplementation(() => ({
      warnOnSiteRuleOverride: false,
      selectedTheme: 'indigo',
      maxBatchUrls: 1,
    }));

    const response = await postSchedule(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest(
          'http://localhost/api/schedules',
          'POST',
          createPayload({
            commandSource: {
              urls: ['https://example.test/a', 'https://example.test/b'],
              userOptions: [],
              excludedOptions: [],
            },
          }),
        ),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe('GET/PUT/DELETE /api/schedules/[scheduleId]', () => {
  test('GET returns full detail (raw recurrence/timezone/startDate/endDate/misfirePolicy) with both masked surfaces, and 404s for a foreign user', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['password', 'secret-value']],
          excludedOptions: [],
        },
        siteOptionsSnapshot: {
          'https://example.test/a': [
            ['cookies', '/data/cookies.txt'],
            ['filename', 'site-name'],
          ],
        },
      }),
    );

    const foreign = await getSchedule(
      stubEvent({ user: { id: 'user-2' }, params: { scheduleId: schedule.id } }),
    );
    expect(foreign.status).toBe(404);
    const foreignEnvelope = await readEnvelope<never>(foreign);
    expect(foreignEnvelope.error).toBe('Not found');
    expect(foreignEnvelope.error).not.toContain(schedule.id);

    const response = await getSchedule(
      stubEvent({ user: { id: 'user-1' }, params: { scheduleId: schedule.id } }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{
      recurrence: unknown;
      timezone: string;
      startDate: string;
      endDate: string | null;
      misfirePolicy: string;
      commandSource: { userOptions: unknown[] };
      siteOptionsSnapshot: Record<string, unknown[]>;
    }>(response);
    expect(envelope.data?.recurrence).toEqual({ kind: 'daily', time: '09:00' });
    expect(envelope.data?.timezone).toBe('UTC');
    expect(envelope.data?.startDate).toBe('2026-01-01');
    expect(envelope.data?.misfirePolicy).toBe('skip');
    expect(envelope.data?.commandSource.userOptions).toEqual([
      ['password', { sensitive: true, hasValue: true }],
    ]);
    expect(envelope.data?.siteOptionsSnapshot['https://example.test/a']).toEqual([
      ['cookies', { sensitive: true, hasValue: true }],
      ['filename', 'site-name'],
    ]);
  });

  test('PUT 404s for a foreign user and 400s on an invalid payload', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const foreign = await putSchedule(
      stubEvent({
        user: { id: 'user-2' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}`, 'PUT', {
          name: 'hijacked',
        }),
      }),
    );
    expect(foreign.status).toBe(404);

    const invalid = await putSchedule(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}`, 'PUT', {
          recurrence: { kind: 'daily' },
        }),
      }),
    );
    expect(invalid.status).toBe(400);
  });

  test('PUT retains a {keep:true} sensitive option, replaces another, and removes an omitted one', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [
            ['password', 'orig-secret'],
            ['filename', 'old-value'],
            ['quiet', true],
          ],
          excludedOptions: [],
        },
      }),
    );

    const response = await putSchedule(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}`, 'PUT', {
          commandSource: {
            urls: ['https://example.test/a'],
            userOptions: [
              ['password', { keep: true }],
              ['filename', 'new-value'],
            ],
            excludedOptions: [],
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ commandSource: { userOptions: unknown[] } }>(response);
    expect(envelope.data?.commandSource.userOptions).toEqual([
      ['password', { sensitive: true, hasValue: true }],
      ['filename', 'new-value'],
    ]);

    const raw = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(raw?.commandSource.userOptions).toEqual([
      ['password', 'orig-secret'],
      ['filename', 'new-value'],
    ]);
  });

  test('PUT on a paused schedule defers recompute: nextOccurrenceAt stays NULL, status stays paused', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ status: 'paused', nextOccurrenceAt: null }),
    );

    const response = await putSchedule(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}`, 'PUT', {
          startDate: '2030-01-01',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ status: string; nextOccurrenceAt: number | null }>(
      response,
    );
    expect(envelope.data?.status).toBe('paused');
    expect(envelope.data?.nextOccurrenceAt).toBeNull();
  });

  test('PUT revives a completed schedule when the edit yields a future occurrence', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        status: 'completed',
        nextOccurrenceAt: null,
        recurrence: { kind: 'once', time: '00:00' },
        startDate: '2020-01-01',
      }),
    );

    const response = await putSchedule(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}`, 'PUT', {
          startDate: '2099-01-01',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ status: string; nextOccurrenceAt: number | null }>(
      response,
    );
    expect(envelope.data?.status).toBe('active');
    expect(envelope.data?.nextOccurrenceAt).not.toBeNull();
  });

  test('DELETE 404s for a foreign user, then succeeds for the owner noting retained history', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const foreign = await deleteSchedule(
      stubEvent({ user: { id: 'user-2' }, params: { scheduleId: schedule.id } }),
    );
    expect(foreign.status).toBe(404);

    const response = await deleteSchedule(
      stubEvent({ user: { id: 'user-1' }, params: { scheduleId: schedule.id } }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ deleted: boolean; message: string }>(response);
    expect(envelope.data?.deleted).toBe(true);
    expect(envelope.data?.message).toMatch(/retained/i);
    expect(scheduleManager.readScheduleForUser(schedule.id, 'user-1')).toBeNull();
  });
});

describe('POST /api/schedules/[scheduleId]/status', () => {
  test('404s for a foreign user', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const response = await postStatus(
      stubEvent({
        user: { id: 'user-2' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/status`, 'POST', {
          status: 'paused',
        }),
      }),
    );
    expect(response.status).toBe(404);
  });

  test('pause nulls nextOccurrenceAt', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 5000 }),
    );

    const response = await postStatus(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/status`, 'POST', {
          status: 'paused',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ status: string; nextOccurrenceAt: number | null }>(
      response,
    );
    expect(envelope.data?.status).toBe('paused');
    expect(envelope.data?.nextOccurrenceAt).toBeNull();
  });

  test('{status:"active"} on a completed schedule with a future recurrence revives it', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        status: 'completed',
        nextOccurrenceAt: null,
        recurrence: { kind: 'daily', time: '09:00' },
        startDate: '2020-01-01',
        endDate: null,
      }),
    );

    const response = await postStatus(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/status`, 'POST', {
          status: 'active',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ status: string; nextOccurrenceAt: number | null }>(
      response,
    );
    expect(envelope.data?.status).toBe('active');
    expect(envelope.data?.nextOccurrenceAt).not.toBeNull();
  });

  test('{status:"active"} on a completed, exhausted schedule stays completed with a 200', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({
        status: 'completed',
        nextOccurrenceAt: null,
        recurrence: { kind: 'once', time: '00:00' },
        startDate: '2020-01-01',
      }),
    );

    const response = await postStatus(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/status`, 'POST', {
          status: 'active',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ status: string; nextOccurrenceAt: number | null }>(
      response,
    );
    expect(envelope.data?.status).toBe('completed');
    expect(envelope.data?.nextOccurrenceAt).toBeNull();
  });

  test('{status:"paused"} on a completed schedule 400s', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ status: 'completed', nextOccurrenceAt: null }),
    );

    const response = await postStatus(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/status`, 'POST', {
          status: 'paused',
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe('POST /api/schedules/[scheduleId]/run', () => {
  test('404s for a foreign user', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const response = await postRun(
      stubEvent({
        user: { id: 'user-2' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/run`, 'POST', {}),
      }),
    );
    expect(response.status).toBe(404);
  });

  test('409s when a job linked to the schedule is still running', async () => {
    seedUser('user-1');
    seedJob('job-running', 'running');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 5000 }),
    );
    const priorRun = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: SEED_TS,
      urlCount: 1,
      launchedCount: 1,
    });
    scheduleRunManager.addRunJob(priorRun.id, 'job-running', 'https://example.test/a');

    const response = await postRun(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/run`, 'POST', {}),
      }),
    );
    expect(response.status).toBe(409);
  });

  test('409s when a dispatch claim from this process is already in flight', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 5000 }),
    );
    // createdAt defaults to Date.now(), always >= PROCESS_START_MS (captured
    // at module import, strictly before any test body runs).
    scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'dispatching',
      scheduledFor: Date.now(),
      urlCount: 1,
    });
    expect(PROCESS_START_MS).toBeLessThanOrEqual(Date.now());

    const response = await postRun(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/run`, 'POST', {}),
      }),
    );
    expect(response.status).toBe(409);
  });

  test('dispatches via the real launcher, links the job, and never touches nextOccurrenceAt/lastOccurrenceAt', async () => {
    seedUser('user-1');
    seedJob('job-1', 'success');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 10_000 }),
    );
    executeGalleryDlCommandMock.mockResolvedValueOnce({ success: true, jobId: 'job-1' });

    const response = await postRun(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/run`, 'POST', {}),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{
      overallSuccess: boolean;
      results: Array<{ url: string; success: boolean; jobId?: string }>;
      runId: string;
    }>(response);
    expect(envelope.data?.overallSuccess).toBe(true);
    expect(envelope.data?.results).toEqual([
      { url: 'https://example.test/a', success: true, jobId: 'job-1' },
    ]);

    const reread = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(reread?.nextOccurrenceAt).toBe(SEED_TS + 10_000);
    expect(reread?.lastOccurrenceAt).toBeNull();

    const runRow = db
      .prepare('SELECT outcome FROM schedule_runs WHERE id = ?')
      .get(envelope.data?.runId) as { outcome: string };
    expect(runRow.outcome).toBe('launched');
  });

  test('a recovery run acknowledges the notification only when the outcome is launched', async () => {
    seedUser('user-1');
    seedJob('job-ok', 'success');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 5000 }),
    );
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'missed_skipped',
      rangeStart: null,
      rangeEnd: null,
    });
    const [notification] = scheduleNotificationManager.readForUser('user-1', {
      limit: 1,
      offset: 0,
    });

    executeGalleryDlCommandMock.mockResolvedValueOnce({ success: true, jobId: 'job-ok' });
    const response = await postRun(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/run`, 'POST', {
          notificationId: notification.id,
        }),
      }),
    );
    expect(response.status).toBe(200);

    const reread = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 })[0];
    expect(reread.acknowledgedAt).not.toBeNull();
  });

  test('a recovery run does NOT acknowledge the notification when the outcome is not launched', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 5000 }),
    );
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'missed_skipped',
      rangeStart: null,
      rangeEnd: null,
    });
    const [notification] = scheduleNotificationManager.readForUser('user-1', {
      limit: 1,
      offset: 0,
    });

    executeGalleryDlCommandMock.mockResolvedValueOnce({ success: false, error: 'boom' });
    const response = await postRun(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        request: jsonRequest(`http://localhost/api/schedules/${schedule.id}/run`, 'POST', {
          notificationId: notification.id,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ overallSuccess: boolean }>(response);
    expect(envelope.data?.overallSuccess).toBe(false);

    const reread = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 })[0];
    expect(reread.acknowledgedAt).toBeNull();
  });
});

describe('GET /api/schedules/[scheduleId]/runs', () => {
  test('404s for a foreign user and paginates newest-first for the owner', async () => {
    seedUser('user-1');
    seedUser('user-2');
    seedJob('job-1', 'success');
    seedJob('job-2', 'success');
    seedJob('job-3', 'success');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const runs = [0, 1, 2].map((i) => {
      const run = scheduleRunManager.createRun({
        scheduleId: schedule.id,
        userId: 'user-1',
        scheduleName: schedule.name,
        trigger: 'scheduled',
        outcome: 'launched',
        scheduledFor: SEED_TS + i,
        urlCount: 1,
        launchedCount: 1,
      });
      db.prepare('UPDATE schedule_runs SET createdAt = ? WHERE id = ?').run(
        SEED_TS + i * 1000,
        run.id,
      );
      scheduleRunManager.addRunJob(run.id, `job-${i + 1}`, `https://example.test/${i}`);
      return run;
    });

    const foreign = await getRuns(
      stubEvent({
        user: { id: 'user-2' },
        params: { scheduleId: schedule.id },
        url: new URL(`http://localhost/api/schedules/${schedule.id}/runs`),
      }),
    );
    expect(foreign.status).toBe(404);

    const response = await getRuns(
      stubEvent({
        user: { id: 'user-1' },
        params: { scheduleId: schedule.id },
        url: new URL(`http://localhost/api/schedules/${schedule.id}/runs?limit=2&offset=0`),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ runs: Array<{ id: string }> }>(response);
    expect(envelope.data?.runs.map((r) => r.id)).toEqual([runs[2].id, runs[1].id]);
  });
});

describe('POST /api/schedules/preview', () => {
  test('returns up to 3 future occurrences plus a recurrenceSummary', async () => {
    const response = await postPreview(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedules/preview', 'POST', {
          recurrence: { kind: 'daily', time: '09:00' },
          timezone: 'UTC',
          startDate: '2020-01-01',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ occurrences: number[]; recurrenceSummary: string }>(
      response,
    );
    expect(envelope.data?.occurrences).toHaveLength(3);
    expect(envelope.data?.recurrenceSummary).toContain('Daily');
  });

  test('returns an empty list, not an error, for an exhausted recurrence', async () => {
    const response = await postPreview(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedules/preview', 'POST', {
          recurrence: { kind: 'once', time: '00:00' },
          timezone: 'UTC',
          startDate: '2020-01-01',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const envelope = await readEnvelope<{ occurrences: number[] }>(response);
    expect(envelope.data?.occurrences).toEqual([]);
  });

  test('400s on an invalid payload', async () => {
    const response = await postPreview(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedules/preview', 'POST', {
          recurrence: { kind: 'daily', time: '09:00' },
          startDate: '2020-01-01',
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe('GET/DELETE /api/schedule-notifications', () => {
  test('lists paginated notifications for the owner, filterable by unread', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'overlap_skipped',
      rangeStart: null,
      rangeEnd: null,
    });
    const rows = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    scheduleNotificationManager.acknowledge(rows[0].id, 'user-1');

    const allResponse = await listNotifications(
      stubEvent({
        user: { id: 'user-1' },
        url: new URL('http://localhost/api/schedule-notifications'),
      }),
    );
    const allEnvelope = await readEnvelope<{ notifications: unknown[] }>(allResponse);
    expect(allEnvelope.data?.notifications).toHaveLength(2);

    const unreadResponse = await listNotifications(
      stubEvent({
        user: { id: 'user-1' },
        url: new URL('http://localhost/api/schedule-notifications?unread=true'),
      }),
    );
    const unreadEnvelope = await readEnvelope<{
      notifications: Array<{ acknowledgedAt: number | null }>;
    }>(unreadResponse);
    expect(unreadEnvelope.data?.notifications).toHaveLength(1);
    expect(unreadEnvelope.data?.notifications[0].acknowledgedAt).toBeNull();
  });

  test('DELETE requires exactly one of ids or acknowledged', async () => {
    seedUser('user-1');

    const both = await deleteNotifications(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedule-notifications', 'DELETE', {
          ids: ['a'],
          acknowledged: true,
        }),
      }),
    );
    expect(both.status).toBe(400);

    const neither = await deleteNotifications(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedule-notifications', 'DELETE', {}),
      }),
    );
    expect(neither.status).toBe(400);
  });

  test('DELETE by ids and by { acknowledged: true }', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'overlap_skipped',
      rangeStart: null,
      rangeEnd: null,
    });
    const rows = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    scheduleNotificationManager.acknowledge(rows[0].id, 'user-1');

    const ackResponse = await deleteNotifications(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedule-notifications', 'DELETE', {
          acknowledged: true,
        }),
      }),
    );
    const ackEnvelope = await readEnvelope<{ deletedCount: number }>(ackResponse);
    expect(ackEnvelope.data?.deletedCount).toBe(1);

    const remaining = scheduleNotificationManager.readForUser('user-1', {
      limit: 10,
      offset: 0,
    });
    expect(remaining).toHaveLength(1);

    const idResponse = await deleteNotifications(
      stubEvent({
        user: { id: 'user-1' },
        request: jsonRequest('http://localhost/api/schedule-notifications', 'DELETE', {
          ids: [remaining[0].id],
        }),
      }),
    );
    const idEnvelope = await readEnvelope<{ deletedCount: number }>(idResponse);
    expect(idEnvelope.data?.deletedCount).toBe(1);
  });
});

describe('GET /api/schedule-notifications/summary', () => {
  test('returns the unread count for the requesting user only', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const scheduleA = scheduleManager.createSchedule(scheduleInput({ userId: 'user-1' }));
    const scheduleB = scheduleManager.createSchedule(
      scheduleInput({ userId: 'user-2', name: 'b' }),
    );
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: scheduleA.id,
      scheduleName: scheduleA.name,
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-2',
      scheduleId: scheduleB.id,
      scheduleName: scheduleB.name,
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });

    const response = await notificationsSummary(stubEvent({ user: { id: 'user-1' } }));
    const envelope = await readEnvelope<{ unread: number }>(response);
    expect(envelope.data?.unread).toBe(1);
  });
});

describe('POST /api/schedule-notifications/[notificationId]/acknowledge', () => {
  test('404s for a missing notification and for a foreign user', async () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    const [row] = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 });

    const missing = await acknowledgeNotification(
      stubEvent({ user: { id: 'user-1' }, params: { notificationId: 'missing-id' } }),
    );
    expect(missing.status).toBe(404);

    const foreign = await acknowledgeNotification(
      stubEvent({ user: { id: 'user-2' }, params: { notificationId: row.id } }),
    );
    expect(foreign.status).toBe(404);
  });

  test('acknowledges and is idempotent on a second call', async () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    const [row] = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 });

    const first = await acknowledgeNotification(
      stubEvent({ user: { id: 'user-1' }, params: { notificationId: row.id } }),
    );
    expect(first.status).toBe(200);
    const firstEnvelope = await readEnvelope<{ acknowledgedAt: number }>(first);

    const second = await acknowledgeNotification(
      stubEvent({ user: { id: 'user-1' }, params: { notificationId: row.id } }),
    );
    expect(second.status).toBe(200);
    const secondEnvelope = await readEnvelope<{ acknowledgedAt: number }>(second);

    expect(secondEnvelope.data?.acknowledgedAt).toBe(firstEnvelope.data?.acknowledgedAt);
  });
});
