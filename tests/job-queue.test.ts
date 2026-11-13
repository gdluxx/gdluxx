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

let jobQueue: typeof import('../src/lib/server/jobs/jobQueue').jobQueue;
let settings: typeof import('../src/lib/server/jobQueueSettings').jobQueueSettingsManager;
let jobsManager: typeof import('../src/lib/server/jobs/jobsManager');

beforeAll(async () => {
  ({ jobQueue } = await import('../src/lib/server/jobs/jobQueue'));
  ({ jobQueueSettingsManager: settings } = await import('../src/lib/server/jobQueueSettings'));
  jobsManager = await import('../src/lib/server/jobs/jobsManager');
  jobQueue.markReady();
});

afterEach(() => {
  db.exec('DELETE FROM jobs; DELETE FROM job_queue_host_starts; DELETE FROM job_queue_settings;');
});

function addWaitingJob(id: string, url: string, createdAt: number): void {
  const payload = JSON.stringify({ kind: 'single', url, cliArgs: [] });
  db.prepare(`INSERT INTO jobs (id, url, status, startTime, queuePayload, createdAt, updatedAt)
    VALUES (?, ?, 'waiting', ?, ?, ?, ?)`)
    .run(id, url, createdAt, payload, createdAt, createdAt);
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('persistent job queue dispatch', () => {
  test('enforces global capacity and starts the next FIFO job when capacity frees', async () => {
    settings.write({ maxConcurrent: 1, perHostEnabled: false, maxConcurrentPerHost: 1, sameHostDelayMs: 0 });
    addWaitingJob('first', 'https://one.example/a', 1);
    addWaitingJob('second', 'https://two.example/b', 2);
    const started: string[] = [];
    jobQueue.registerRunner(async (id) => { started.push(id); });

    await settle();
    expect(started).toEqual(['first']);
    expect(jobsManager.readWaitingJobs().map((job) => job.id)).toEqual(['second']);

    db.prepare("UPDATE jobs SET status = 'success' WHERE id = 'first'").run();
    jobQueue.capacityChanged();
    await settle();
    expect(started).toEqual(['first', 'second']);
  });

  test('applies the optional per-host limit while allowing another host to use capacity', async () => {
    settings.write({ maxConcurrent: 3, perHostEnabled: true, maxConcurrentPerHost: 1, sameHostDelayMs: 0 });
    addWaitingJob('host-a-1', 'https://a.example/one', 1);
    addWaitingJob('host-a-2', 'https://a.example/two', 2);
    addWaitingJob('host-b-1', 'https://b.example/one', 3);
    const started: string[] = [];
    jobQueue.registerRunner(async (id) => { started.push(id); });

    await settle();
    expect(started).toEqual(['host-a-1', 'host-b-1']);
    db.prepare("UPDATE jobs SET status = 'success' WHERE id = 'host-a-1'").run();
    jobQueue.capacityChanged();
    await settle();
    expect(started).toEqual(['host-a-1', 'host-b-1', 'host-a-2']);
  });

  test('waits for the configured same-host start delay', async () => {
    settings.write({ maxConcurrent: 2, perHostEnabled: true, maxConcurrentPerHost: 2, sameHostDelayMs: 25 });
    db.prepare('INSERT INTO job_queue_host_starts (hostname, startedAt) VALUES (?, ?)')
      .run('slow.example', Date.now());
    addWaitingJob('delayed', 'https://slow.example/path', Date.now());
    const started: string[] = [];
    jobQueue.registerRunner(async (id) => { started.push(id); });

    await settle();
    expect(started).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(started).toEqual(['delayed']);
  });
});
