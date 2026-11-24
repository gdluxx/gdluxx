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
import { resolveJobQueueConfig, type JobQueueConfig } from '../src/lib/server/jobs/jobQueueConfig';
import { createJobQueue, type JobQueueHandlers } from '../src/lib/server/jobs/jobQueue';
import * as queuedExecution from '../src/lib/server/jobs/queuedExecution';
import type { GalleryDlMode } from '../src/lib/types/gallery-dl-mode';

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

afterEach(() => {
  db.exec('DELETE FROM jobs');
});

const NO_LIMITS: JobQueueConfig = {
  maxConcurrent: 5,
  maxConcurrentPerHost: null,
  sameHostDelayMs: 0,
};

let createdAt = 0;

function payloadFor(url: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    policy: 'restricted',
    kind: 'single',
    url,
    cliArgs: [],
    ...overrides,
  });
}

function addWaitingJob(id: string, queuePayload: string): void {
  createdAt += 1;
  db.prepare(
    `INSERT INTO jobs (id, url, status, startTime, queuePayload, createdAt, updatedAt)
     VALUES (?, 'https://unused.test', 'waiting', ?, ?, ?, ?)`,
  ).run(id, createdAt, queuePayload, createdAt, createdAt);
}

function finishJob(id: string): void {
  db.prepare("UPDATE jobs SET status = 'success' WHERE id = ?").run(id);
}

function statusOf(id: string): string {
  return (db.prepare('SELECT status FROM jobs WHERE id = ?').get(id) as { status: string }).status;
}

function startQueue(config: JobQueueConfig, policy: GalleryDlMode = 'restricted') {
  const started: string[] = [];
  const failed: Array<{ id: string; message: string; retryable: boolean }> = [];
  const handlers: JobQueueHandlers = {
    start: vi.fn(async (id: string) => {
      started.push(id);
    }),
    fail: vi.fn(async (id: string, message: string, retryable: boolean) => {
      failed.push({ id, message, retryable });
      db.prepare("UPDATE jobs SET status = 'error' WHERE id = ?").run(id);
    }),
  };
  const queue = createJobQueue(config, policy);
  queue.registerHandlers(handlers);
  queue.markReady();
  return { queue, handlers, started, failed };
}

async function settle(ms = 0): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('job queue configuration', () => {
  test('defaults to 5 concurrent jobs with no per-host limit or delay', () => {
    expect(resolveJobQueueConfig({})).toEqual({
      config: { maxConcurrent: 5, maxConcurrentPerHost: null, sameHostDelayMs: 0 },
      warnings: [],
    });
  });

  test('treats empty values as unset', () => {
    const { config, warnings } = resolveJobQueueConfig({
      GDLUXX_MAX_CONCURRENT_JOBS: '',
      GDLUXX_MAX_CONCURRENT_JOBS_PER_HOST: ' ',
      GDLUXX_SAME_HOST_START_DELAY_SECONDS: '',
    });

    expect(config).toEqual({ maxConcurrent: 5, maxConcurrentPerHost: null, sameHostDelayMs: 0 });
    expect(warnings).toEqual([]);
  });

  test('reads valid values and converts the delay to milliseconds', () => {
    expect(
      resolveJobQueueConfig({
        GDLUXX_MAX_CONCURRENT_JOBS: '10',
        GDLUXX_MAX_CONCURRENT_JOBS_PER_HOST: '2',
        GDLUXX_SAME_HOST_START_DELAY_SECONDS: '30',
      }).config,
    ).toEqual({ maxConcurrent: 10, maxConcurrentPerHost: 2, sameHostDelayMs: 30_000 });
  });

  test.each([
    ['GDLUXX_MAX_CONCURRENT_JOBS', '0'],
    ['GDLUXX_MAX_CONCURRENT_JOBS', '101'],
    ['GDLUXX_MAX_CONCURRENT_JOBS', 'five'],
    ['GDLUXX_MAX_CONCURRENT_JOBS', '2.5'],
    ['GDLUXX_MAX_CONCURRENT_JOBS_PER_HOST', '-1'],
    ['GDLUXX_SAME_HOST_START_DELAY_SECONDS', '3601'],
  ])('falls back to the default and warns when %s is %s', (name, value) => {
    const { config, warnings } = resolveJobQueueConfig({ [name]: value });

    expect(config).toEqual({ maxConcurrent: 5, maxConcurrentPerHost: null, sameHostDelayMs: 0 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(name);
  });
});

describe('queued execution payloads', () => {
  test('accepts a current payload', () => {
    const parsed = queuedExecution.parseQueuedExecution(
      payloadFor('https://a.test/1'),
      'restricted',
    );

    expect(parsed).toEqual({
      ok: true,
      payload: {
        version: 1,
        policy: 'restricted',
        kind: 'single',
        url: 'https://a.test/1',
        cliArgs: [],
      },
    });
  });

  test.each([
    ['malformed JSON', '{not json'],
    ['a missing payload', null],
    ['a payload with no version', JSON.stringify({ kind: 'single', url: 'x', cliArgs: [] })],
    ['a batch with no URLs', payloadFor('directlink batch', { kind: 'batch' })],
  ])('refuses %s as invalid', (_label, raw) => {
    expect(queuedExecution.parseQueuedExecution(raw, 'restricted')).toEqual({
      ok: false,
      reason: queuedExecution.QUEUED_EXECUTION_MESSAGES.invalid,
    });
  });

  test('refuses a payload from another version', () => {
    expect(
      queuedExecution.parseQueuedExecution(
        payloadFor('https://a.test', { version: 2 }),
        'restricted',
      ),
    ).toEqual({ ok: false, reason: queuedExecution.QUEUED_EXECUTION_MESSAGES.version });
  });

  test('refuses an Unrestricted payload once the server runs Restricted', () => {
    const raw = payloadFor('https://a.test', { policy: 'unrestricted' });

    expect(queuedExecution.parseQueuedExecution(raw, 'restricted')).toEqual({
      ok: false,
      reason: queuedExecution.QUEUED_EXECUTION_MESSAGES.policy,
    });
    expect(queuedExecution.parseQueuedExecution(raw, 'unrestricted').ok).toBe(true);
  });

  test('accepts a Restricted payload under either policy', () => {
    expect(
      queuedExecution.parseQueuedExecution(payloadFor('https://a.test'), 'unrestricted').ok,
    ).toBe(true);
  });
});

describe('job queue dispatch', () => {
  test('starts nothing before it is marked ready', async () => {
    addWaitingJob('first', payloadFor('https://one.test/a'));
    const queue = createJobQueue(NO_LIMITS, 'restricted');
    const start = vi.fn(async () => undefined);
    queue.registerHandlers({ start, fail: vi.fn(async () => undefined) });

    queue.capacityChanged();
    await settle();

    expect(start).not.toHaveBeenCalled();
  });

  test('enforces the global limit and starts the next job in FIFO order when capacity frees', async () => {
    addWaitingJob('first', payloadFor('https://one.test/a'));
    addWaitingJob('second', payloadFor('https://two.test/b'));
    const { queue, started } = startQueue({ ...NO_LIMITS, maxConcurrent: 1 });

    await settle();
    expect(started).toEqual(['first']);
    expect(statusOf('first')).toBe('running');
    expect(statusOf('second')).toBe('waiting');

    finishJob('first');
    queue.capacityChanged();
    await settle();
    expect(started).toEqual(['first', 'second']);
  });

  test('starts the first job synchronously when there is capacity', () => {
    addWaitingJob('first', payloadFor('https://one.test/a'));

    const { started } = startQueue(NO_LIMITS);

    expect(started).toEqual(['first']);
  });

  test('applies the per-host limit while letting another host use the capacity', async () => {
    addWaitingJob('a-1', payloadFor('https://a.test/one'));
    addWaitingJob('a-2', payloadFor('https://a.test/two'));
    addWaitingJob('b-1', payloadFor('https://b.test/one'));
    const { queue, started } = startQueue({
      ...NO_LIMITS,
      maxConcurrent: 3,
      maxConcurrentPerHost: 1,
    });

    await settle();
    expect(started).toEqual(['a-1', 'b-1']);

    finishJob('a-1');
    queue.capacityChanged();
    await settle();
    expect(started).toEqual(['a-1', 'b-1', 'a-2']);
  });

  test('waits out the same-host start delay without needing a per-host limit', async () => {
    addWaitingJob('first', payloadFor('https://slow.test/1'));
    addWaitingJob('second', payloadFor('https://slow.test/2'));
    addWaitingJob('other', payloadFor('https://fast.test/1'));
    const { started } = startQueue({ ...NO_LIMITS, sameHostDelayMs: 40 });

    await settle();
    expect(started).toEqual(['first', 'other']);

    await settle(60);
    expect(started).toEqual(['first', 'other', 'second']);
  });

  test('fails an Unrestricted job after a restart into Restricted instead of starting it', async () => {
    addWaitingJob('flipped', payloadFor('https://a.test', { policy: 'unrestricted' }));
    addWaitingJob('fine', payloadFor('https://b.test'));
    const { started, failed } = startQueue(NO_LIMITS, 'restricted');

    await settle();

    expect(failed).toEqual([
      {
        id: 'flipped',
        message: queuedExecution.QUEUED_EXECUTION_MESSAGES.policy,
        retryable: false,
      },
    ]);
    expect(started).toEqual(['fine']);
  });

  test('fails jobs with an unknown payload version or an invalid payload', async () => {
    addWaitingJob('old', payloadFor('https://a.test', { version: 99 }));
    addWaitingJob('broken', '{not json');
    const { started, failed } = startQueue(NO_LIMITS);

    await settle();

    expect(failed).toEqual([
      { id: 'old', message: queuedExecution.QUEUED_EXECUTION_MESSAGES.version, retryable: false },
      {
        id: 'broken',
        message: queuedExecution.QUEUED_EXECUTION_MESSAGES.invalid,
        retryable: false,
      },
    ]);
    expect(started).toEqual([]);
  });

  test('fails a job whose start handler throws', async () => {
    addWaitingJob('boom', payloadFor('https://a.test'));
    const queue = createJobQueue(NO_LIMITS, 'restricted');
    const fail = vi.fn(async () => undefined);
    queue.registerHandlers({
      start: async () => {
        throw new Error('runner exploded');
      },
      fail,
    });
    queue.markReady();

    await settle();

    expect(fail).toHaveBeenCalledWith(
      'boom',
      expect.stringContaining('could not start this job'),
      true,
    );
  });

  test('deleting a running job frees its slot for the next waiting job', async () => {
    addWaitingJob('kept', payloadFor('https://a.test'));
    addWaitingJob('next', payloadFor('https://c.test'));
    const { queue, started } = startQueue({ ...NO_LIMITS, maxConcurrent: 1 });
    await settle();
    expect(started).toEqual(['kept']);

    db.prepare("DELETE FROM jobs WHERE id = 'kept'").run();
    queue.capacityChanged();
    await settle();

    expect(started).toEqual(['kept', 'next']);
  });
});
