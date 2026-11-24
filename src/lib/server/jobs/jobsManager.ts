/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { openDatabase } from '$lib/server/database';
import type { JobOutput } from '$lib/server/jobs/jobManager';
import { serverLogger } from '$lib/server/logger';
import type { JobListItem, JobStatus, JobsSummary } from '$lib/types/jobs';

const db = openDatabase();

function getCurrentTimestamp(): number {
  return Date.now();
}

export interface DatabaseJob {
  id: string;
  url: string;
  status: JobStatus;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  batchCount?: number;
  queuePayload?: string;
  retryOfJobId?: string;
  outputs: JobOutput[];
}

export interface JobsPageOptions {
  limit: number;
  offset: number;
  statuses?: JobStatus[];
  sort: 'time' | 'downloads';
  dir: 'asc' | 'desc';
}

interface JobListRow {
  id: string;
  url: string;
  status: string;
  startTime: number;
  endTime: number | null;
  exitCode: number | null;
  downloadCount: number;
  skipCount: number;
  batchCount: number | null;
  retryOfJobId: string | null;
  retriedByJobId: string | null;
  retryable: number;
}

export interface QueuedJobRow {
  id: string;
  url: string;
  queuePayload: string | null;
}

export interface RetrySourceRow {
  id: string;
  url: string;
  status: string;
  batchCount: number | null;
  queuePayload: string | null;
  retriedByJobId: string | null;
}

const VALID_STATUSES: readonly JobStatus[] = [
  'waiting',
  'running',
  'success',
  'no_action',
  'error',
];

const SORT_COLUMN_MAP: Record<JobsPageOptions['sort'], string> = {
  time: 'startTime',
  downloads: 'downloadCount',
};

// Correlated against an unaliased outer `FROM jobs`.
const RETRY_CHILD_SQL = 'SELECT child.id FROM jobs child WHERE child.retryOfJobId = jobs.id';
const RETRIED_BY_SQL = `(${RETRY_CHILD_SQL} ORDER BY child.createdAt DESC, child.rowid DESC LIMIT 1)`;
const RETRYABLE_SQL = `(status = 'error' AND queuePayload IS NOT NULL AND NOT EXISTS (${RETRY_CHILD_SQL}))`;

const JOB_LIST_COLUMNS = `id, url, status, startTime, endTime, exitCode, downloadCount, skipCount, batchCount,
  retryOfJobId, ${RETRIED_BY_SQL} AS retriedByJobId, ${RETRYABLE_SQL} AS retryable`;

const MAX_JOB_OUTPUTS = 10000;

function coerceStatus(status: string, jobId: string): JobStatus {
  if (VALID_STATUSES.includes(status as JobStatus)) {
    return status as JobStatus;
  }
  serverLogger.error('Invalid job status found, defaulting to error', {
    invalidStatus: status,
    jobId,
  });
  return 'error';
}

function mapListRow(row: JobListRow): JobListItem {
  return {
    id: row.id,
    url: row.url,
    status: coerceStatus(row.status, row.id),
    startTime: row.startTime,
    endTime: row.endTime ?? undefined,
    exitCode: row.exitCode ?? undefined,
    downloadCount: row.downloadCount || 0,
    skipCount: row.skipCount || 0,
    batchCount: row.batchCount ?? undefined,
    retryOfJobId: row.retryOfJobId ?? undefined,
    retriedByJobId: row.retriedByJobId ?? undefined,
    retryable: Boolean(row.retryable),
  };
}

function normaliseStatuses(statuses?: JobStatus[]): JobStatus[] {
  if (!statuses || statuses.length === 0) {
    return [];
  }
  return statuses.filter((status) => VALID_STATUSES.includes(status));
}

export function readJobsPage(options: JobsPageOptions): JobListItem[] {
  try {
    const column = SORT_COLUMN_MAP[options.sort] ?? 'startTime';
    const direction = options.dir === 'asc' ? 'ASC' : 'DESC';

    const statuses = normaliseStatuses(options.statuses);
    const params: Array<string | number> = [];
    let whereClause = '';
    if (statuses.length > 0) {
      whereClause = `WHERE status IN (${statuses.map(() => '?').join(', ')})`;
      params.push(...statuses);
    }
    params.push(options.limit, options.offset);

    const stmt = db.prepare(`
      SELECT ${JOB_LIST_COLUMNS}
      FROM jobs
      ${whereClause}
      ORDER BY ${column} ${direction}, id DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(...params) as JobListRow[];
    return rows.map(mapListRow);
  } catch (error) {
    serverLogger.error('Error reading jobs page from database:', error);
    return [];
  }
}

export function countJobs(statuses?: JobStatus[]): number {
  try {
    const filtered = normaliseStatuses(statuses);
    if (filtered.length > 0) {
      const stmt = db.prepare(
        `SELECT COUNT(*) as count FROM jobs WHERE status IN (${filtered.map(() => '?').join(', ')})`,
      );
      const row = stmt.get(...filtered) as { count: number };
      return row.count;
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
    return row.count;
  } catch (error) {
    serverLogger.error('Error counting jobs in database:', error);
    return 0;
  }
}

export function readJobsSummary(): JobsSummary {
  try {
    const counts = { waiting: 0, running: 0, success: 0, no_action: 0, error: 0, total: 0 };
    const totals = { downloads: 0, skips: 0 };

    const grouped = db
      .prepare(
        `SELECT status, COUNT(*) as count, SUM(downloadCount) as downloads, SUM(skipCount) as skips
         FROM jobs
         GROUP BY status`,
      )
      .all() as Array<{
      status: string;
      count: number;
      downloads: number | null;
      skips: number | null;
    }>;

    for (const row of grouped) {
      const status = coerceStatus(row.status, 'summary');
      counts[status] += row.count;
      counts.total += row.count;
      totals.downloads += row.downloads ?? 0;
      totals.skips += row.skips ?? 0;
    }

    const { retryableFailedCount } = db
      .prepare(`SELECT COUNT(*) AS retryableFailedCount FROM jobs WHERE ${RETRYABLE_SQL}`)
      .get() as { retryableFailedCount: number };

    const runningRows = db.prepare("SELECT id FROM jobs WHERE status = 'running'").all() as Array<{
      id: string;
    }>;
    const runningJobIds = runningRows.map((row) => row.id);

    const recentRows = db
      .prepare(
        `SELECT ${JOB_LIST_COLUMNS}
         FROM jobs
         ORDER BY startTime DESC, id DESC
         LIMIT 5`,
      )
      .all() as JobListRow[];
    const recent = recentRows.map(mapListRow);

    return { counts, totals, retryableFailedCount, runningJobIds, recent };
  } catch (error) {
    serverLogger.error('Error reading jobs summary from database:', error);
    return {
      counts: { waiting: 0, running: 0, success: 0, no_action: 0, error: 0, total: 0 },
      totals: { downloads: 0, skips: 0 },
      retryableFailedCount: 0,
      runningJobIds: [],
      recent: [],
    };
  }
}

export function readRunningJobIds(): string[] {
  try {
    const rows = db.prepare("SELECT id FROM jobs WHERE status = 'running'").all() as Array<{
      id: string;
    }>;
    return rows.map((row) => row.id);
  } catch (error) {
    serverLogger.error('Error reading running job ids from database:', error);
    return [];
  }
}

export function readJobById(id: string): JobListItem | undefined {
  try {
    const row = db.prepare(`SELECT ${JOB_LIST_COLUMNS} FROM jobs WHERE id = ?`).get(id) as
      | JobListRow
      | undefined;
    return row ? mapListRow(row) : undefined;
  } catch (error) {
    serverLogger.error('Error reading job by id from database:', error);
    return undefined;
  }
}

export function readJobsByIds(ids: string[]): JobListItem[] {
  if (ids.length === 0) {
    return [];
  }
  try {
    const rows = db
      .prepare(
        `SELECT ${JOB_LIST_COLUMNS} FROM jobs WHERE id IN (${ids.map(() => '?').join(', ')})`,
      )
      .all(...ids) as JobListRow[];
    return rows.map(mapListRow);
  } catch (error) {
    serverLogger.error('Error reading jobs by ids from database:', error);
    // Never return [] here, callers read a missing id as a deleted job.
    throw error;
  }
}

export function readJobOutputs(id: string): JobOutput[] {
  try {
    const rows = db
      .prepare(
        `SELECT type, data, timestamp
         FROM job_outputs
         WHERE jobId = ?
         ORDER BY timestamp
         LIMIT ?`,
      )
      .all(id, MAX_JOB_OUTPUTS) as Array<{ type: string; data: string; timestamp: number }>;
    return rows.map((row) => ({
      type: row.type as JobOutput['type'],
      data: row.data,
      timestamp: row.timestamp,
    }));
  } catch (error) {
    serverLogger.error('Error reading job outputs from database:', error);
    return [];
  }
}

function insertJob(job: Omit<DatabaseJob, 'outputs'>): void {
  const now = getCurrentTimestamp();

  db.prepare(
    `
      INSERT INTO jobs (id, url, status, startTime, endTime, exitCode, downloadCount, skipCount,
                        batchCount, queuePayload, retryOfJobId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    job.id,
    job.url,
    job.status,
    job.startTime,
    job.endTime || null,
    job.exitCode || null,
    job.downloadCount || 0,
    job.skipCount || 0,
    job.batchCount || null,
    job.queuePayload || null,
    job.retryOfJobId || null,
    now,
    now,
  );
}

export async function createJob(job: Omit<DatabaseJob, 'outputs'>): Promise<void> {
  try {
    insertJob(job);
  } catch (error) {
    serverLogger.error('Error creating job in database:', error);
    throw new Error('Failed to create job.', { cause: error });
  }
}

export function readRetrySource(id: string): RetrySourceRow | undefined {
  try {
    return db
      .prepare(
        `SELECT id, url, status, batchCount, queuePayload, ${RETRIED_BY_SQL} AS retriedByJobId
         FROM jobs WHERE id = ?`,
      )
      .get(id) as RetrySourceRow | undefined;
  } catch (error) {
    serverLogger.error('Error reading retry source job from database:', error);
    return undefined;
  }
}

/**
 * Returns false, inserting nothing, when the parent stopped being retryable
 * after the caller read it.
 */
export function createRetryJob(
  job: Omit<DatabaseJob, 'outputs'> & { retryOfJobId: string },
): boolean {
  try {
    return db.transaction((): boolean => {
      const parent = db
        .prepare(`SELECT ${RETRYABLE_SQL} AS retryable FROM jobs WHERE id = ?`)
        .get(job.retryOfJobId) as { retryable: number } | undefined;
      if (!parent?.retryable) {
        return false;
      }
      insertJob(job);
      return true;
    })();
  } catch (error) {
    serverLogger.error('Error creating retry job in database:', error);
    throw new Error('Failed to create retry job.', { cause: error });
  }
}

export function readRetryableFailedJobIds(limit: number): string[] {
  try {
    const rows = db
      .prepare(`SELECT id FROM jobs WHERE ${RETRYABLE_SQL} ORDER BY createdAt, rowid LIMIT ?`)
      .all(limit) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  } catch (error) {
    serverLogger.error('Error reading retryable failed jobs from database:', error);
    return [];
  }
}

export async function updateJob(
  jobId: string,
  updates: Partial<
    Pick<DatabaseJob, 'status' | 'endTime' | 'exitCode' | 'downloadCount' | 'skipCount'> & {
      queuePayload: string | null;
    }
  >,
): Promise<void> {
  try {
    const now = getCurrentTimestamp();
    const setParts: string[] = [];
    const values: Array<string | number | null> = [];

    if (updates.status !== undefined) {
      setParts.push('status = ?');
      values.push(updates.status);
    }
    if (updates.endTime !== undefined) {
      setParts.push('endTime = ?');
      values.push(updates.endTime);
    }
    if (updates.exitCode !== undefined) {
      setParts.push('exitCode = ?');
      values.push(updates.exitCode);
    }
    if (updates.downloadCount !== undefined) {
      setParts.push('downloadCount = ?');
      values.push(updates.downloadCount);
    }
    if (updates.skipCount !== undefined) {
      setParts.push('skipCount = ?');
      values.push(updates.skipCount);
    }
    if (updates.queuePayload !== undefined) {
      setParts.push('queuePayload = ?');
      values.push(updates.queuePayload);
    }

    if (setParts.length === 0) {
      return;
    }

    setParts.push('updatedAt = ?');
    values.push(now);
    values.push(jobId);

    const stmt = db.prepare(`
      UPDATE jobs 
      SET ${setParts.join(', ')} 
      WHERE id = ?
    `);

    stmt.run(...values);
  } catch (error) {
    serverLogger.error('Error updating job in database:', error);
    throw new Error('Failed to update job.', { cause: error });
  }
}

export function readWaitingJobs(): QueuedJobRow[] {
  try {
    return db
      .prepare(
        "SELECT id, url, queuePayload FROM jobs WHERE status = 'waiting' ORDER BY createdAt, rowid",
      )
      .all() as QueuedJobRow[];
  } catch (error) {
    serverLogger.error('Error reading waiting jobs from database:', error);
    return [];
  }
}

export function readRunningPayloads(): Array<Pick<QueuedJobRow, 'id' | 'queuePayload'>> {
  try {
    return db.prepare("SELECT id, queuePayload FROM jobs WHERE status = 'running'").all() as Array<
      Pick<QueuedJobRow, 'id' | 'queuePayload'>
    >;
  } catch (error) {
    serverLogger.error('Error reading running jobs from database:', error);
    return [];
  }
}

// Returns false when the job is no longer waiting (deleted or already started)
export function reserveWaitingJob(id: string, startTime: number): boolean {
  try {
    const result = db
      .prepare(
        "UPDATE jobs SET status = 'running', startTime = ?, updatedAt = ? WHERE id = ? AND status = 'waiting'",
      )
      .run(startTime, getCurrentTimestamp(), id);
    return result.changes > 0;
  } catch (error) {
    serverLogger.error('Error reserving waiting job in database:', error);
    throw new Error('Failed to reserve waiting job.', { cause: error });
  }
}

export async function addJobOutput(jobId: string, output: JobOutput): Promise<void> {
  try {
    const stmt = db.prepare(`
      INSERT INTO job_outputs (jobId, type, data, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(jobId, output.type, output.data, output.timestamp);
  } catch (error) {
    serverLogger.error('Error adding job output to database:', error);
    throw new Error('Failed to add job output.', { cause: error });
  }
}

export async function deleteJob(jobId: string): Promise<boolean> {
  try {
    // Foreign key constraints will automatically delete related job_outputs
    const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
    const result = stmt.run(jobId);
    return result.changes > 0;
  } catch (error) {
    serverLogger.error('Error deleting job from database:', error);
    throw new Error('Failed to delete job.', { cause: error });
  }
}

export function deleteJobs(ids: string[]): number {
  if (ids.length === 0) {
    return 0;
  }
  try {
    // Foreign key constraints will automatically delete related job_outputs
    const deleteMany = db.transaction((jobIds: string[]): number => {
      const stmt = db.prepare(`DELETE FROM jobs WHERE id IN (${jobIds.map(() => '?').join(', ')})`);
      return stmt.run(...jobIds).changes;
    });
    return deleteMany(ids);
  } catch (error) {
    serverLogger.error('Error deleting jobs from database:', error);
    throw new Error('Failed to delete jobs.', { cause: error });
  }
}

export function deleteAllJobs(): number {
  try {
    // Foreign key constraints will automatically delete related job_outputs
    const deleteAll = db.transaction((): number => db.prepare('DELETE FROM jobs').run().changes);
    return deleteAll();
  } catch (error) {
    serverLogger.error('Error deleting all jobs from database:', error);
    throw new Error('Failed to delete all jobs.', { cause: error });
  }
}
