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

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const database = new Database(':memory:');
  database.exec(readFileSync(new URL('../src/lib/server/schema.sql', import.meta.url), 'utf8'));
  return { db: database };
});

vi.mock('$lib/server/database', () => ({
  openDatabase: () => db,
  getSharedDatabase: () => db,
}));
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const retryPreconditionErrorMock = vi.fn();
vi.mock('$lib/server/jobs/retryPreconditions', () => ({
  retryPreconditionError: () => retryPreconditionErrorMock(),
}));

const { jobManager, RetryJobError } = await import('$lib/server/jobs/jobManager');
const { readJobById, readJobsSummary, readRetryableFailedJobIds } =
  await import('$lib/server/jobs/jobsManager');
const { QUEUED_EXECUTION_MESSAGES } = await import('$lib/server/jobs/queuedExecution');
const { POST: retryRoute } = await import('../src/routes/api/command/job/[jobId]/retry/+server');
const { POST: retryFailedRoute } = await import('../src/routes/api/jobs/retry-failed/+server');

let createdAt = 0;

function payloadFor(url: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    policy: 'restricted',
    kind: 'single',
    url,
    cliArgs: ['--no-skip'],
    ...overrides,
  });
}

function insertJob(
  id: string,
  options: {
    status?: string;
    url?: string;
    queuePayload?: string | null;
    batchCount?: number | null;
  } = {},
): void {
  createdAt += 1;
  const url = options.url ?? `https://example.test/${id}`;
  db.prepare(
    `INSERT INTO jobs (id, url, status, startTime, endTime, exitCode, batchCount, queuePayload,
                       createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    url,
    options.status ?? 'error',
    createdAt,
    createdAt + 1,
    1,
    options.batchCount ?? null,
    options.queuePayload === undefined ? payloadFor(url) : options.queuePayload,
    createdAt,
    createdAt,
  );
  db.prepare(
    "INSERT INTO job_outputs (jobId, type, data, timestamp) VALUES (?, 'stderr', 'original log', ?)",
  ).run(id, createdAt);
}

function row(id: string) {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
}

function outputCount(id: string): number {
  return (
    db.prepare('SELECT COUNT(*) AS count FROM job_outputs WHERE jobId = ?').get(id) as {
      count: number;
    }
  ).count;
}

function fakeController() {
  return {
    enqueue: vi.fn(),
    close: vi.fn(),
  } as unknown as ReadableStreamDefaultController<Uint8Array>;
}

// Typed by the handler it is passed too.
function requestEvent<T>(params: Record<string, string> = {}): T {
  return {
    params,
    request: new Request('http://localhost/', { method: 'POST' }),
    locals: { user: { id: 'test-user' } },
  } as T;
}

async function expectRetryError(id: string, statusCode: number, message: string | RegExp) {
  const error = await jobManager.retryJob(id).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(RetryJobError);
  expect((error as InstanceType<typeof RetryJobError>).statusCode).toBe(statusCode);
  expect((error as Error).message).toMatch(message);
}

beforeEach(async () => {
  await jobManager.whenReady();
  retryPreconditionErrorMock.mockResolvedValue(null);
});

afterEach(async () => {
  await jobManager.deleteAllJobs();
});

describe('retrying a failed job', () => {
  test('queues a new linked job and leaves the failed job and its output untouched', async () => {
    insertJob('failed');
    const before = row('failed');

    const { jobId, status } = await jobManager.retryJob('failed');

    expect(jobId).not.toBe('failed');
    expect(status).toBe('waiting');
    expect(row(jobId)).toMatchObject({
      url: 'https://example.test/failed',
      status: 'waiting',
      retryOfJobId: 'failed',
      queuePayload: payloadFor('https://example.test/failed'),
    });
    expect(row('failed')).toEqual(before);
    expect(outputCount('failed')).toBe(1);
    expect(readJobById('failed')).toMatchObject({ retryable: false, retriedByJobId: jobId });
  });

  test('replays a batch job with its URLs and batch count', async () => {
    const payload = payloadFor('directlink batch', {
      kind: 'batch',
      urls: ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg'],
    });
    insertJob('batch', { url: 'directlink batch', batchCount: 2, queuePayload: payload });

    const { jobId } = await jobManager.retryJob('batch');

    expect(row(jobId)).toMatchObject({ url: 'directlink batch', batchCount: 2 });
    expect(JSON.parse(row(jobId)?.queuePayload as string)).toEqual(JSON.parse(payload));
  });

  test('refuses jobs that are not failed', async () => {
    insertJob('done', { status: 'success' });

    await expectRetryError('done', 409, 'Only failed jobs can be retried.');
  });

  test('refuses a job that was already retried', async () => {
    insertJob('failed');
    await jobManager.retryJob('failed');

    await expectRetryError('failed', 409, 'already been retried');
  });

  test('refuses a failed job with no stored command', async () => {
    insertJob('legacy', { queuePayload: null });

    await expectRetryError('legacy', 409, 'no stored command');
    expect(readJobById('legacy')?.retryable).toBe(false);
  });

  test('refuses an Unrestricted command while the server runs Restricted', async () => {
    insertJob('flipped', {
      queuePayload: payloadFor('https://example.test/flipped', { policy: 'unrestricted' }),
    });

    await expectRetryError('flipped', 409, QUEUED_EXECUTION_MESSAGES.policy);
    expect(row('flipped')?.queuePayload).toBeNull();
    expect(readJobById('flipped')?.retryable).toBe(false);
  });

  test('reports an unknown job as not found', async () => {
    await expectRetryError('missing', 404, 'Job not found.');
  });

  test('a chain is retried from its newest failed job', async () => {
    insertJob('first');
    insertJob('unrelated');
    const { jobId: second } = await jobManager.retryJob('first');
    await jobManager.failJob(second, 'failed again');

    expect(readRetryableFailedJobIds(10)).toEqual(['unrelated', second]);
    expect(readRetryableFailedJobIds(1)).toEqual(['unrelated']);
    expect(readJobsSummary().retryableFailedCount).toBe(2);
    expect(readJobById(second)).toMatchObject({ retryOfJobId: 'first', retryable: true });
  });

  test('deleting the retry makes the original retryable again', async () => {
    insertJob('failed');
    const { jobId } = await jobManager.retryJob('failed');

    await jobManager.deleteJob(jobId);

    expect(readJobById('failed')).toMatchObject({ retryable: true, retriedByJobId: undefined });
  });
});

describe('queued jobs in memory', () => {
  test('a waiting job stays in memory after its last subscriber leaves', async () => {
    insertJob('failed');
    const { jobId } = await jobManager.retryJob('failed');
    const inMemory = await jobManager.getJob(jobId);
    const controller = fakeController();

    await jobManager.addSubscriber(jobId, controller);
    await jobManager.removeSubscriber(jobId, controller);

    expect(await jobManager.getJob(jobId)).toBe(inMemory);
    expect(controller.close).not.toHaveBeenCalled();
  });

  test('markQueuedJobRunning reloads a job that is missing from memory', async () => {
    insertJob('reserved', { status: 'running', queuePayload: payloadFor('https://a.test') });

    expect(jobManager.markQueuedJobRunning('reserved', 123)).toBe(true);
    await jobManager.addOutput('reserved', 'info', 'started');
    await jobManager.completeJob('reserved', 0);

    expect(row('reserved')).toMatchObject({ status: 'no_action', queuePayload: null });
    expect(outputCount('reserved')).toBe(2);
  });

  test('failJob records why the job failed and keeps its command for a retry', async () => {
    insertJob('failed');
    const { jobId } = await jobManager.retryJob('failed');

    await jobManager.failJob(jobId, 'Refused to start.');

    expect(row(jobId)).toMatchObject({ status: 'error', exitCode: 1 });
    expect(row(jobId)?.queuePayload).not.toBeNull();
    expect(db.prepare('SELECT type, data FROM job_outputs WHERE jobId = ?').all(jobId)).toEqual([
      { type: 'error', data: 'Refused to start.' },
    ]);
  });

  test('failJob without retryable clears the stored command', async () => {
    insertJob('failed');
    const { jobId } = await jobManager.retryJob('failed');

    await jobManager.failJob(jobId, 'Refused to start.', { retryable: false });

    expect(row(jobId)).toMatchObject({ status: 'error', queuePayload: null });
    expect(readJobById(jobId)?.retryable).toBe(false);
  });

  test('completeJob without retryable leaves a failed job with no command to replay', async () => {
    insertJob('handed-off', { status: 'running' });
    expect(jobManager.markQueuedJobRunning('handed-off', 123)).toBe(true);

    await jobManager.completeJob('handed-off', 64, { retryable: false });

    expect(row('handed-off')).toMatchObject({ status: 'error', exitCode: 64, queuePayload: null });
    expect(readJobById('handed-off')?.retryable).toBe(false);
  });

  test('failJob ignores a job that no longer exists', async () => {
    await expect(jobManager.failJob('missing', 'x')).resolves.toBeUndefined();
  });
});

describe('POST /api/command/job/[jobId]/retry', () => {
  test('returns the new job linked to the failed one', async () => {
    insertJob('failed');

    const response = await retryRoute(requestEvent({ jobId: 'failed' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      jobId: expect.any(String),
      retryOfJobId: 'failed',
      status: 'waiting',
    });
  });

  test('rejects an invalid job id', async () => {
    const response = await retryRoute(requestEvent({ jobId: 'x'.repeat(65) }));

    expect(response.status).toBe(400);
  });

  test('maps retry refusals to their status codes', async () => {
    insertJob('done', { status: 'success' });

    const notFound = await retryRoute(requestEvent({ jobId: 'missing' }));
    const conflict = await retryRoute(requestEvent({ jobId: 'done' }));

    expect(notFound.status).toBe(404);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe('Only failed jobs can be retried.');
  });

  test('returns the precondition error without creating a job', async () => {
    insertJob('failed');
    retryPreconditionErrorMock.mockResolvedValue(new Response(null, { status: 500 }));

    const response = await retryRoute(requestEvent({ jobId: 'failed' }));

    expect(response.status).toBe(500);
    expect(readJobById('failed')?.retryable).toBe(true);
  });
});

describe('POST /api/jobs/retry-failed', () => {
  test('retries every retryable failed job, oldest first', async () => {
    insertJob('old');
    insertJob('legacy', { queuePayload: null });
    insertJob('done', { status: 'success' });
    insertJob('flipped', {
      queuePayload: payloadFor('https://example.test/flipped', { policy: 'unrestricted' }),
    });
    insertJob('new');

    const response = await retryFailedRoute(requestEvent());
    const body = await response.json();

    expect(body.data).toMatchObject({ total: 3, accepted: 2, failed: 1 });
    expect(body.data.results).toEqual([
      expect.objectContaining({ retryOfJobId: 'old', success: true }),
      { retryOfJobId: 'flipped', success: false, error: QUEUED_EXECUTION_MESSAGES.policy },
      expect.objectContaining({ retryOfJobId: 'new', success: true }),
    ]);
    expect(readJobsSummary().retryableFailedCount).toBe(0);
    expect(readRetryableFailedJobIds(10)).not.toContain('flipped');
  });

  test('returns the precondition error without retrying anything', async () => {
    insertJob('failed');
    retryPreconditionErrorMock.mockResolvedValue(new Response(null, { status: 409 }));

    const response = await retryFailedRoute(requestEvent());

    expect(response.status).toBe(409);
    expect(readJobsSummary().retryableFailedCount).toBe(1);
  });
});
