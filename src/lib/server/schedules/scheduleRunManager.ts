/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/* eslint-disable no-console */

import type { Statement } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
// getSharedDatabase, not openDatabase: claimAdvance/createRun/finalizeRun run
// inside the coordinator's transaction on the shared connection; a per-module
// connection would sit outside it.
import { getSharedDatabase } from '$lib/server/database';

const db = getSharedDatabase();

// Re-declared locally rather than imported from settingsManager, which sits
// on a live import cycle (logger.ts -> loggingManager.ts -> settingsManager.ts
// -> logger.ts) that would drag winston into this module.
function getCurrentTimestamp(): number {
  return Date.now();
}

export type RunTrigger = 'scheduled' | 'catch_up' | 'manual' | 'recovery';
export type RunOutcome =
  | 'dispatching'
  | 'launched'
  | 'partial'
  | 'launch_failed'
  | 'skipped_overlap'
  | 'skipped_misfire';

export interface ScheduleRun {
  id: string;
  scheduleId: string | null;
  userId: string;
  scheduleName: string;
  trigger: RunTrigger;
  outcome: RunOutcome;
  scheduledFor: number;
  urlCount: number;
  launchedCount: number;
  missedFrom: number | null;
  missedTo: number | null;
  missedCount: number | null;
  truncated: boolean;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleRunWithJobs extends ScheduleRun {
  jobIds: string[];
}

export interface JobOrigin {
  scheduleId: string | null;
  scheduleName: string;
  ownerUserId: string;
}

interface ScheduleRunRow {
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
  createdAt: number;
  updatedAt: number;
}

export interface CreateRunInput {
  scheduleId: string | null;
  userId: string;
  scheduleName: string;
  trigger: RunTrigger;
  outcome: RunOutcome;
  scheduledFor: number;
  urlCount: number;
  launchedCount?: number;
  missedFrom?: number | null;
  missedTo?: number | null;
  missedCount?: number | null;
  truncated?: boolean;
  error?: string | null;
}

export interface FinalizeRunFields {
  outcome: RunOutcome;
  launchedCount: number;
  error?: string | null;
}

const RUN_COLUMNS =
  'id, scheduleId, userId, scheduleName, trigger, outcome, scheduledFor, urlCount, ' +
  'launchedCount, missedFrom, missedTo, missedCount, truncated, error, createdAt, updatedAt';

interface PreparedStatements {
  insert: Statement<
    [
      string,
      string | null,
      string,
      string,
      string,
      string,
      number,
      number,
      number,
      number | null,
      number | null,
      number | null,
      number,
      string | null,
      number,
      number,
    ]
  >;
  selectById: Statement<[string]>;
  finalize: Statement<[string, number, string | null, number, string]>;
  addJob: Statement<[string, string, string]>;
  countJobsForRun: Statement<[string]>;
  runsForSchedule: Statement<[string, string, number, number]>;
  staleDispatching: Statement<[number]>;
  blocking: Statement<[string, string, number]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    try {
      statements = {
        insert: db.prepare(`
          INSERT INTO schedule_runs (
            id, scheduleId, userId, scheduleName, trigger, outcome, scheduledFor,
            urlCount, launchedCount, missedFrom, missedTo, missedCount, truncated,
            error, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        selectById: db.prepare(`SELECT ${RUN_COLUMNS} FROM schedule_runs WHERE id = ?`),
        finalize: db.prepare(`
          UPDATE schedule_runs SET outcome = ?, launchedCount = ?, error = ?, updatedAt = ?
          WHERE id = ?
        `),
        addJob: db.prepare('INSERT INTO schedule_run_jobs (runId, jobId, url) VALUES (?, ?, ?)'),
        countJobsForRun: db.prepare(
          'SELECT COUNT(*) AS count FROM schedule_run_jobs WHERE runId = ?',
        ),
        runsForSchedule: db.prepare(`
          SELECT sr.id, sr.scheduleId, sr.userId, sr.scheduleName, sr.trigger, sr.outcome,
                 sr.scheduledFor, sr.urlCount, sr.launchedCount, sr.missedFrom, sr.missedTo,
                 sr.missedCount, sr.truncated, sr.error, sr.createdAt, sr.updatedAt,
                 GROUP_CONCAT(srj.jobId) AS jobIds
          FROM schedule_runs sr
          LEFT JOIN schedule_run_jobs srj ON srj.runId = sr.id
          WHERE sr.scheduleId = ? AND sr.userId = ?
          GROUP BY sr.id
          ORDER BY sr.createdAt DESC
          LIMIT ? OFFSET ?
        `),
        staleDispatching: db.prepare(
          `SELECT ${RUN_COLUMNS} FROM schedule_runs WHERE outcome = 'dispatching' AND createdAt < ?`,
        ),
        blocking: db.prepare(`
          SELECT (
            EXISTS (
              SELECT 1 FROM schedule_runs sr
              JOIN schedule_run_jobs srj ON srj.runId = sr.id
              JOIN jobs j ON j.id = srj.jobId
              WHERE sr.scheduleId = ? AND j.status = 'running'
            )
            OR EXISTS (
              SELECT 1 FROM schedule_runs
              WHERE scheduleId = ? AND outcome = 'dispatching' AND createdAt >= ?
            )
          ) AS blocked
        `),
      };
    } catch (error) {
      console.error('Failed to prepare schedule run statements', error);
      throw error;
    }
  }
  return statements;
}

function mapRow(row: ScheduleRunRow): ScheduleRun {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    userId: row.userId,
    scheduleName: row.scheduleName,
    trigger: row.trigger as RunTrigger,
    outcome: row.outcome as RunOutcome,
    scheduledFor: row.scheduledFor,
    urlCount: row.urlCount,
    launchedCount: row.launchedCount,
    missedFrom: row.missedFrom,
    missedTo: row.missedTo,
    missedCount: row.missedCount,
    truncated: row.truncated === 1,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createRun(input: CreateRunInput): ScheduleRun {
  const now = getCurrentTimestamp();
  const id = uuidv4();
  try {
    getStatements().insert.run(
      id,
      input.scheduleId,
      input.userId,
      input.scheduleName,
      input.trigger,
      input.outcome,
      input.scheduledFor,
      input.urlCount,
      input.launchedCount ?? 0,
      input.missedFrom ?? null,
      input.missedTo ?? null,
      input.missedCount ?? null,
      input.truncated ? 1 : 0,
      input.error ?? null,
      now,
      now,
    );
  } catch (error) {
    console.error('Failed to create schedule run', error);
    throw error;
  }
  const row = getStatements().selectById.get(id) as ScheduleRunRow;
  return mapRow(row);
}

export function finalizeRun(id: string, fields: FinalizeRunFields): ScheduleRun | null {
  try {
    const result = getStatements().finalize.run(
      fields.outcome,
      fields.launchedCount,
      fields.error ?? null,
      getCurrentTimestamp(),
      id,
    );
    if (result.changes === 0) {
      return null;
    }
  } catch (error) {
    console.error('Failed to finalize schedule run', error);
    throw error;
  }
  const row = getStatements().selectById.get(id) as ScheduleRunRow | undefined;
  return row ? mapRow(row) : null;
}

export function addRunJob(runId: string, jobId: string, url: string): void {
  try {
    getStatements().addJob.run(runId, jobId, url);
  } catch (error) {
    console.error('Failed to link job to schedule run', error);
    throw error;
  }
}

export function countLinkedJobsForRun(runId: string): number {
  try {
    const row = getStatements().countJobsForRun.get(runId) as { count: number };
    return row.count;
  } catch (error) {
    console.error('Failed to count linked jobs for schedule run', error);
    return 0;
  }
}

export function readRunsForSchedule(
  scheduleId: string,
  userId: string,
  options: { limit: number; offset: number },
): ScheduleRunWithJobs[] {
  try {
    const rows = getStatements().runsForSchedule.all(
      scheduleId,
      userId,
      options.limit,
      options.offset,
    ) as Array<ScheduleRunRow & { jobIds: string | null }>;
    return rows.map((row) => ({
      ...mapRow(row),
      jobIds: row.jobIds ? row.jobIds.split(',') : [],
    }));
  } catch (error) {
    console.error('Failed to read runs for schedule', error);
    return [];
  }
}

export function readLatestRunOutcomes(
  scheduleIds: string[],
): Map<string, { outcome: RunOutcome; createdAt: number }> {
  const result = new Map<string, { outcome: RunOutcome; createdAt: number }>();
  if (scheduleIds.length === 0) {
    return result;
  }
  try {
    const placeholders = scheduleIds.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT scheduleId, outcome, createdAt FROM (
           SELECT scheduleId, outcome, createdAt,
             ROW_NUMBER() OVER (PARTITION BY scheduleId ORDER BY createdAt DESC, id DESC) AS rn
           FROM schedule_runs
           WHERE scheduleId IN (${placeholders})
         ) WHERE rn = 1`,
      )
      .all(...scheduleIds) as Array<{ scheduleId: string; outcome: string; createdAt: number }>;
    for (const row of rows) {
      result.set(row.scheduleId, { outcome: row.outcome as RunOutcome, createdAt: row.createdAt });
    }
  } catch (error) {
    console.error('Failed to read latest run outcomes', error);
  }
  return result;
}

export function readStaleDispatchingRuns(beforeMs: number): ScheduleRun[] {
  try {
    const rows = getStatements().staleDispatching.all(beforeMs) as ScheduleRunRow[];
    return rows.map(mapRow);
  } catch (error) {
    console.error('Failed to read stale dispatching runs', error);
    return [];
  }
}

/**
 * True when EITHER a job linked to this schedule is still `running` OR a
 * claim from *this* process is mid-dispatch (`createdAt >= processStartMs`).
 * Older `dispatching` rows are stale claims from a previous process, already
 * reconciled at startup — they must not count as blocking here.
 */
export function hasBlockingActivityForSchedule(
  scheduleId: string,
  processStartMs: number,
): boolean {
  try {
    const row = getStatements().blocking.get(scheduleId, scheduleId, processStartMs) as
      | { blocked: number }
      | undefined;
    return row?.blocked === 1;
  } catch (error) {
    console.error('Failed to check blocking activity for schedule', error);
    return false;
  }
}

export function readJobOrigins(jobIds: string[]): Map<string, JobOrigin> {
  const result = new Map<string, JobOrigin>();
  if (jobIds.length === 0) {
    return result;
  }
  try {
    const placeholders = jobIds.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT srj.jobId AS jobId, sr.scheduleId AS scheduleId, sr.scheduleName AS scheduleName,
                sr.userId AS ownerUserId
         FROM schedule_run_jobs srj
         JOIN schedule_runs sr ON sr.id = srj.runId
         WHERE srj.jobId IN (${placeholders})`,
      )
      .all(...jobIds) as Array<{
      jobId: string;
      scheduleId: string | null;
      scheduleName: string;
      ownerUserId: string;
    }>;
    for (const row of rows) {
      result.set(row.jobId, {
        scheduleId: row.scheduleId,
        scheduleName: row.scheduleName,
        ownerUserId: row.ownerUserId,
      });
    }
  } catch (error) {
    console.error('Failed to read job origins', error);
  }
  return result;
}
