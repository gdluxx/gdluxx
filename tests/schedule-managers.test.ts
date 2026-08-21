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
import type * as ScheduleNotificationManagerShape from '../src/lib/server/schedules/scheduleNotificationManager';

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

type ScheduleManagerModule = typeof ScheduleManagerShape;
type ScheduleRunManagerModule = typeof ScheduleRunManagerShape;
type ScheduleNotificationManagerModule = typeof ScheduleNotificationManagerShape;

let scheduleManager: ScheduleManagerModule;
let scheduleRunManager: ScheduleRunManagerModule;
let scheduleNotificationManager: ScheduleNotificationManagerModule;

beforeAll(async () => {
  scheduleManager = await import('$lib/server/schedules/scheduleManager');
  scheduleRunManager = await import('$lib/server/schedules/scheduleRunManager');
  scheduleNotificationManager = await import('$lib/server/schedules/scheduleNotificationManager');
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

function setCreatedAt(
  table: 'schedule_runs' | 'schedule_notifications',
  id: string,
  createdAt: number,
): void {
  db.prepare(`UPDATE ${table} SET createdAt = ? WHERE id = ?`).run(createdAt, id);
}

function scheduleInput(
  overrides: Partial<ScheduleManagerShape.CreateScheduleInput> = {},
): ScheduleManagerShape.CreateScheduleInput {
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

afterEach(() => {
  // Every case must leave the connection with no open transaction — these
  // managers never open one themselves; that's the caller's job.
  expect(db.inTransaction).toBe(false);

  db.exec(`
    DELETE FROM schedule_notifications;
    DELETE FROM schedule_run_jobs;
    DELETE FROM schedule_runs;
    DELETE FROM schedules;
    DELETE FROM jobs;
    DELETE FROM user;
  `);
});

describe('sanity', () => {
  test('foreign key enforcement is on', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('scheduleManager CRUD + ownership', () => {
  test('createSchedule persists and round-trips JSON columns', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    expect(schedule.id).toBeTruthy();
    expect(schedule.userId).toBe('user-1');
    expect(schedule.status).toBe('active');
    expect(schedule.recurrence).toEqual({ kind: 'daily', time: '09:00' });
    expect(schedule.commandSource).toEqual({
      urls: ['https://example.test/a'],
      userOptions: [],
      excludedOptions: [],
    });
  });

  test('readSchedulesForUser and readScheduleForUser are scoped by owner', () => {
    seedUser('user-1');
    seedUser('user-2');
    const own = scheduleManager.createSchedule(scheduleInput({ userId: 'user-1' }));
    scheduleManager.createSchedule(scheduleInput({ userId: 'user-2', name: 'other' }));

    expect(scheduleManager.readSchedulesForUser('user-1').map((s) => s.id)).toEqual([own.id]);
    expect(scheduleManager.readScheduleForUser(own.id, 'user-2')).toBeNull();
    expect(scheduleManager.readScheduleForUser(own.id, 'user-1')?.id).toBe(own.id);
  });

  test('updateSchedule only applies for the owning user', () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    expect(scheduleManager.updateSchedule(schedule.id, 'user-2', { name: 'hijacked' })).toBeNull();
    const updated = scheduleManager.updateSchedule(schedule.id, 'user-1', { name: 'renamed' });
    expect(updated?.name).toBe('renamed');
  });

  test('updateSchedule with no fields is a no-op read', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const result = scheduleManager.updateSchedule(schedule.id, 'user-1', {});
    expect(result?.name).toBe(schedule.name);
  });

  test('deleteScheduleForUser only deletes for the owning user', () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    expect(scheduleManager.deleteScheduleForUser(schedule.id, 'user-2')).toBe(false);
    expect(scheduleManager.readScheduleForUser(schedule.id, 'user-1')).not.toBeNull();
    expect(scheduleManager.deleteScheduleForUser(schedule.id, 'user-1')).toBe(true);
    expect(scheduleManager.readScheduleForUser(schedule.id, 'user-1')).toBeNull();
  });

  test('setScheduleStatus pauses (nulling nextOccurrenceAt) and resumes', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const paused = scheduleManager.setScheduleStatus(schedule.id, 'user-1', {
      status: 'paused',
      nextOccurrenceAt: null,
    });
    expect(paused?.status).toBe('paused');
    expect(paused?.nextOccurrenceAt).toBeNull();

    const resumed = scheduleManager.setScheduleStatus(schedule.id, 'user-1', {
      status: 'active',
      nextOccurrenceAt: SEED_TS + 5000,
    });
    expect(resumed?.status).toBe('active');
    expect(resumed?.nextOccurrenceAt).toBe(SEED_TS + 5000);
  });
});

describe('readDueSchedules', () => {
  test('boundary: <= now, NULL excluded, paused/completed excluded', () => {
    seedUser('user-1');
    const now = SEED_TS + 10_000;

    const duePast = scheduleManager.createSchedule(
      scheduleInput({ name: 'due-past', nextOccurrenceAt: now - 1000 }),
    );
    const dueExact = scheduleManager.createSchedule(
      scheduleInput({ name: 'due-exact', nextOccurrenceAt: now }),
    );
    scheduleManager.createSchedule(
      scheduleInput({ name: 'not-yet', nextOccurrenceAt: now + 1000 }),
    );
    scheduleManager.createSchedule(
      scheduleInput({ name: 'paused', status: 'paused', nextOccurrenceAt: null }),
    );
    scheduleManager.createSchedule(
      scheduleInput({ name: 'completed', status: 'completed', nextOccurrenceAt: null }),
    );

    const result = scheduleManager.readDueSchedules(now);
    expect(result.map((s) => s.id).sort()).toEqual([duePast.id, dueExact.id].sort());
  });
});

describe('claimAdvance', () => {
  test('applies the conditional advance and returns 1 change on a match', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 1000 }),
    );

    const changes = scheduleManager.claimAdvance(schedule.id, SEED_TS + 1000, {
      nextOccurrenceAt: SEED_TS + 2000,
      lastOccurrenceAt: SEED_TS + 1000,
      status: 'active',
    });

    expect(changes).toBe(1);
    const reread = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(reread?.nextOccurrenceAt).toBe(SEED_TS + 2000);
    expect(reread?.lastOccurrenceAt).toBe(SEED_TS + 1000);
  });

  test('returns 0 changes on a mismatched expectedNextOccurrenceAt (concurrent edit wins)', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 1000 }),
    );

    const changes = scheduleManager.claimAdvance(schedule.id, SEED_TS + 9999, {
      nextOccurrenceAt: SEED_TS + 2000,
      lastOccurrenceAt: SEED_TS + 1000,
      status: 'active',
    });

    expect(changes).toBe(0);
    const reread = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(reread?.nextOccurrenceAt).toBe(SEED_TS + 1000);
  });

  test('returns 0 changes when the schedule is no longer active', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ status: 'paused', nextOccurrenceAt: null }),
    );

    const changes = scheduleManager.claimAdvance(schedule.id, SEED_TS + 1000, {
      nextOccurrenceAt: SEED_TS + 2000,
      lastOccurrenceAt: SEED_TS + 1000,
      status: 'active',
    });

    expect(changes).toBe(0);
  });

  test('claiming to completed leaves nextOccurrenceAt NULL and satisfies the CHECK constraint', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(
      scheduleInput({ nextOccurrenceAt: SEED_TS + 1000 }),
    );

    const changes = scheduleManager.claimAdvance(schedule.id, SEED_TS + 1000, {
      nextOccurrenceAt: null,
      lastOccurrenceAt: SEED_TS + 1000,
      status: 'completed',
    });

    expect(changes).toBe(1);
    const reread = scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    expect(reread?.status).toBe('completed');
    expect(reread?.nextOccurrenceAt).toBeNull();
  });
});

describe('scheduleRunManager run lifecycle', () => {
  test('createRun, addRunJob, finalizeRun round-trip', () => {
    seedUser('user-1');
    seedJob('job-1', 'success');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'dispatching',
      scheduledFor: SEED_TS,
      urlCount: 1,
    });
    expect(run.outcome).toBe('dispatching');
    expect(run.launchedCount).toBe(0);

    scheduleRunManager.addRunJob(run.id, 'job-1', 'https://example.test/a');

    const finalized = scheduleRunManager.finalizeRun(run.id, {
      outcome: 'launched',
      launchedCount: 1,
    });
    expect(finalized?.outcome).toBe('launched');
    expect(finalized?.launchedCount).toBe(1);
  });

  test('finalizeRun returns null for a missing run id', () => {
    expect(
      scheduleRunManager.finalizeRun('missing-run', { outcome: 'launched', launchedCount: 1 }),
    ).toBeNull();
  });

  test('readRunsForSchedule paginates newest-first, scoped by owner, with linked job ids', () => {
    seedUser('user-1');
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
      setCreatedAt('schedule_runs', run.id, SEED_TS + i * 1000);
      scheduleRunManager.addRunJob(run.id, `job-${i + 1}`, `https://example.test/${i}`);
      return run;
    });

    const page1 = scheduleRunManager.readRunsForSchedule(schedule.id, 'user-1', {
      limit: 2,
      offset: 0,
    });
    expect(page1.map((r) => r.id)).toEqual([runs[2].id, runs[1].id]);
    expect(page1[0].jobIds).toEqual(['job-3']);

    const page2 = scheduleRunManager.readRunsForSchedule(schedule.id, 'user-1', {
      limit: 2,
      offset: 2,
    });
    expect(page2.map((r) => r.id)).toEqual([runs[0].id]);

    expect(
      scheduleRunManager.readRunsForSchedule(schedule.id, 'user-2', { limit: 10, offset: 0 }),
    ).toEqual([]);
  });

  test('readLatestRunOutcomes groups by schedule and picks the newest row', () => {
    seedUser('user-1');
    const scheduleA = scheduleManager.createSchedule(scheduleInput({ name: 'A' }));
    const scheduleB = scheduleManager.createSchedule(scheduleInput({ name: 'B' }));

    const a1 = scheduleRunManager.createRun({
      scheduleId: scheduleA.id,
      userId: 'user-1',
      scheduleName: 'A',
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: SEED_TS,
      urlCount: 1,
      launchedCount: 1,
    });
    setCreatedAt('schedule_runs', a1.id, SEED_TS + 100);

    const a2 = scheduleRunManager.createRun({
      scheduleId: scheduleA.id,
      userId: 'user-1',
      scheduleName: 'A',
      trigger: 'scheduled',
      outcome: 'partial',
      scheduledFor: SEED_TS + 1,
      urlCount: 1,
    });
    setCreatedAt('schedule_runs', a2.id, SEED_TS + 300);

    const b1 = scheduleRunManager.createRun({
      scheduleId: scheduleB.id,
      userId: 'user-1',
      scheduleName: 'B',
      trigger: 'scheduled',
      outcome: 'skipped_overlap',
      scheduledFor: SEED_TS,
      urlCount: 1,
    });
    setCreatedAt('schedule_runs', b1.id, SEED_TS + 50);

    const outcomes = scheduleRunManager.readLatestRunOutcomes([scheduleA.id, scheduleB.id]);
    expect(outcomes.get(scheduleA.id)).toEqual({ outcome: 'partial', createdAt: SEED_TS + 300 });
    expect(outcomes.get(scheduleB.id)).toEqual({
      outcome: 'skipped_overlap',
      createdAt: SEED_TS + 50,
    });
  });

  test('readLatestRunOutcomes returns an empty map for an empty input', () => {
    expect(scheduleRunManager.readLatestRunOutcomes([]).size).toBe(0);
  });
});

describe('readStaleDispatchingRuns', () => {
  test('returns only dispatching rows older than the cutoff', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    const stale = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'dispatching',
      scheduledFor: SEED_TS,
      urlCount: 1,
    });
    setCreatedAt('schedule_runs', stale.id, SEED_TS - 10_000);

    const fresh = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'dispatching',
      scheduledFor: SEED_TS + 1,
      urlCount: 1,
    });
    setCreatedAt('schedule_runs', fresh.id, SEED_TS + 10_000);

    const result = scheduleRunManager.readStaleDispatchingRuns(SEED_TS);
    expect(result.map((r) => r.id)).toEqual([stale.id]);
  });
});

describe('hasBlockingActivityForSchedule', () => {
  test('true when a linked job is still running', () => {
    seedUser('user-1');
    seedJob('job-1', 'running');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: SEED_TS,
      urlCount: 1,
      launchedCount: 1,
    });
    scheduleRunManager.addRunJob(run.id, 'job-1', 'https://example.test/a');

    expect(scheduleRunManager.hasBlockingActivityForSchedule(schedule.id, SEED_TS + 999_999)).toBe(
      true,
    );
  });

  test('true for an in-flight dispatching claim from this process', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const processStart = SEED_TS;
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'dispatching',
      scheduledFor: SEED_TS,
      urlCount: 1,
    });
    setCreatedAt('schedule_runs', run.id, processStart + 500);

    expect(scheduleRunManager.hasBlockingActivityForSchedule(schedule.id, processStart)).toBe(true);
  });

  test('false for a stale dispatching claim excluded by the processStartMs floor', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const processStart = SEED_TS + 100_000;
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'dispatching',
      scheduledFor: SEED_TS,
      urlCount: 1,
    });
    setCreatedAt('schedule_runs', run.id, processStart - 1);

    expect(scheduleRunManager.hasBlockingActivityForSchedule(schedule.id, processStart)).toBe(
      false,
    );
  });
});

describe('readJobOrigins', () => {
  test('reports the owning schedule, and degrades to a NULL scheduleId after deletion', () => {
    seedUser('user-1');
    seedJob('job-1', 'success');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: SEED_TS,
      urlCount: 1,
      launchedCount: 1,
    });
    scheduleRunManager.addRunJob(run.id, 'job-1', 'https://example.test/a');

    let origins = scheduleRunManager.readJobOrigins(['job-1']);
    expect(origins.get('job-1')).toEqual({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      ownerUserId: 'user-1',
    });

    scheduleManager.deleteScheduleForUser(schedule.id, 'user-1');

    origins = scheduleRunManager.readJobOrigins(['job-1']);
    expect(origins.get('job-1')).toEqual({
      scheduleId: null,
      scheduleName: schedule.name,
      ownerUserId: 'user-1',
    });
  });

  test('returns an empty map for an empty input', () => {
    expect(scheduleRunManager.readJobOrigins([]).size).toBe(0);
  });
});

describe('scheduleNotificationManager coalescing', () => {
  test('folds repeated events into one unacknowledged row, then starts fresh after acknowledgement', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());

    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'missed_skipped',
      rangeStart: 100,
      rangeEnd: 200,
    });
    let rows = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    const firstId = rows[0].id;
    expect(rows[0].occurrenceCount).toBe(1);
    expect(rows[0].rangeEnd).toBe(200);

    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'missed_skipped',
      rangeStart: 100,
      rangeEnd: 300,
    });
    rows = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(firstId);
    expect(rows[0].occurrenceCount).toBe(2);
    expect(rows[0].rangeEnd).toBe(300);

    scheduleNotificationManager.acknowledge(firstId, 'user-1');
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'missed_skipped',
      rangeStart: 100,
      rangeEnd: 400,
    });
    rows = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    expect(rows).toHaveLength(2);
    const fresh = rows.find((r) => r.id !== firstId);
    expect(fresh?.occurrenceCount).toBe(1);
    expect(fresh?.acknowledgedAt).toBeNull();
    expect(scheduleNotificationManager.countUnreadForUser('user-1')).toBe(1);
  });

  test('a NULL scheduleId (deleted schedule) never folds; every event inserts a fresh row', () => {
    seedUser('user-1');
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: null,
      scheduleName: 'gone',
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: null,
      scheduleName: 'gone',
      runId: null,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });
    const rows = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.occurrenceCount === 1)).toBe(true);
  });
});

describe('countUnreadForUser', () => {
  test('counts only the given user’s unacknowledged notifications', () => {
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

    expect(scheduleNotificationManager.countUnreadForUser('user-1')).toBe(1);
    expect(scheduleNotificationManager.countUnreadForUser('user-2')).toBe(1);
  });
});

describe('acknowledge', () => {
  test('is idempotent: a second call does not move acknowledgedAt', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'overlap_skipped',
      rangeStart: null,
      rangeEnd: null,
    });
    const [row] = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 });

    const first = scheduleNotificationManager.acknowledge(row.id, 'user-1');
    const second = scheduleNotificationManager.acknowledge(row.id, 'user-1');
    expect(first?.acknowledgedAt).toBe(second?.acknowledgedAt);
  });

  test('returns null for a non-owned or missing notification', () => {
    seedUser('user-1');
    seedUser('user-2');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: null,
      type: 'overlap_skipped',
      rangeStart: null,
      rangeEnd: null,
    });
    const [row] = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 });

    expect(scheduleNotificationManager.acknowledge(row.id, 'user-2')).toBeNull();
    expect(scheduleNotificationManager.acknowledge('missing-id', 'user-1')).toBeNull();
  });
});

describe('deleteForUser', () => {
  test('deletes by id, scoped to the owner', () => {
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
    const [rowA] = scheduleNotificationManager.readForUser('user-1', { limit: 1, offset: 0 });
    const [rowB] = scheduleNotificationManager.readForUser('user-2', { limit: 1, offset: 0 });

    const deleted = scheduleNotificationManager.deleteForUser('user-1', {
      ids: [rowA.id, rowB.id],
    });
    expect(deleted).toBe(1);
    expect(scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 })).toEqual([]);
    expect(
      scheduleNotificationManager.readForUser('user-2', { limit: 10, offset: 0 }),
    ).toHaveLength(1);
  });

  test('deletes only acknowledged rows when { acknowledged: true }', () => {
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

    const deleted = scheduleNotificationManager.deleteForUser('user-1', { acknowledged: true });
    expect(deleted).toBe(1);
    const remaining = scheduleNotificationManager.readForUser('user-1', { limit: 10, offset: 0 });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].acknowledgedAt).toBeNull();
  });
});

describe('foreign key behavior', () => {
  test('deleting a schedule SET NULLs scheduleId on history but keeps the denormalized name', () => {
    seedUser('user-1');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: SEED_TS,
      urlCount: 1,
      launchedCount: 1,
    });
    scheduleNotificationManager.upsertCoalesced({
      userId: 'user-1',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId: run.id,
      type: 'launch_failed',
      rangeStart: null,
      rangeEnd: null,
    });

    expect(scheduleManager.deleteScheduleForUser(schedule.id, 'user-1')).toBe(true);

    const runRow = db
      .prepare('SELECT scheduleId, scheduleName FROM schedule_runs WHERE id = ?')
      .get(run.id) as { scheduleId: string | null; scheduleName: string };
    expect(runRow.scheduleId).toBeNull();
    expect(runRow.scheduleName).toBe(schedule.name);

    const notificationRow = db
      .prepare('SELECT scheduleId, scheduleName FROM schedule_notifications WHERE runId = ?')
      .get(run.id) as { scheduleId: string | null; scheduleName: string };
    expect(notificationRow.scheduleId).toBeNull();
    expect(notificationRow.scheduleName).toBe(schedule.name);
  });

  test('deleting a job cascades its schedule_run_jobs link but the run survives with its counts intact', () => {
    seedUser('user-1');
    seedJob('job-1', 'success');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'launched',
      scheduledFor: SEED_TS,
      urlCount: 1,
      launchedCount: 1,
    });
    scheduleRunManager.addRunJob(run.id, 'job-1', 'https://example.test/a');

    db.prepare('DELETE FROM jobs WHERE id = ?').run('job-1');

    const linkCount = (
      db.prepare('SELECT COUNT(*) AS n FROM schedule_run_jobs WHERE runId = ?').get(run.id) as {
        n: number;
      }
    ).n;
    expect(linkCount).toBe(0);

    const survivingRun = db
      .prepare('SELECT urlCount, launchedCount FROM schedule_runs WHERE id = ?')
      .get(run.id) as { urlCount: number; launchedCount: number };
    expect(survivingRun).toEqual({ urlCount: 1, launchedCount: 1 });
  });

  test('a raw DELETE FROM jobs succeeds with link rows present (regression pin for deleteAllJobs)', () => {
    seedUser('user-1');
    seedJob('job-1', 'success');
    seedJob('job-2', 'error');
    const schedule = scheduleManager.createSchedule(scheduleInput());
    const run = scheduleRunManager.createRun({
      scheduleId: schedule.id,
      userId: 'user-1',
      scheduleName: schedule.name,
      trigger: 'scheduled',
      outcome: 'partial',
      scheduledFor: SEED_TS,
      urlCount: 2,
      launchedCount: 1,
    });
    scheduleRunManager.addRunJob(run.id, 'job-1', 'https://example.test/a');
    scheduleRunManager.addRunJob(run.id, 'job-2', 'https://example.test/b');

    expect(() => db.prepare('DELETE FROM jobs').run()).not.toThrow();

    const linkCount = (
      db.prepare('SELECT COUNT(*) AS n FROM schedule_run_jobs').get() as { n: number }
    ).n;
    expect(linkCount).toBe(0);
    expect(db.prepare('SELECT id FROM schedule_runs WHERE id = ?').get(run.id)).toBeDefined();
  });
});
