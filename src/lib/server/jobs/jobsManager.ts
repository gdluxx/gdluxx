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
}

const VALID_STATUSES: readonly JobStatus[] = ['running', 'success', 'no_action', 'error'];

const SORT_COLUMN_MAP: Record<JobsPageOptions['sort'], string> = {
  time: 'startTime',
  downloads: 'downloadCount',
};

const JOB_LIST_COLUMNS =
  'id, url, status, startTime, endTime, exitCode, downloadCount, skipCount, batchCount';

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
    const counts = { running: 0, success: 0, no_action: 0, error: 0, total: 0 };
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

    return { counts, totals, runningJobIds, recent };
  } catch (error) {
    serverLogger.error('Error reading jobs summary from database:', error);
    return {
      counts: { running: 0, success: 0, no_action: 0, error: 0, total: 0 },
      totals: { downloads: 0, skips: 0 },
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

export async function createJob(job: Omit<DatabaseJob, 'outputs'>): Promise<void> {
  try {
    const now = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO jobs (id, url, status, startTime, endTime, exitCode, downloadCount, skipCount, batchCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.url,
      job.status,
      job.startTime,
      job.endTime || null,
      job.exitCode || null,
      job.downloadCount || 0,
      job.skipCount || 0,
      job.batchCount || null,
      now,
      now,
    );
  } catch (error) {
    serverLogger.error('Error creating job in database:', error);
    throw new Error('Failed to create job.', { cause: error });
  }
}

export async function updateJob(
  jobId: string,
  updates: Partial<
    Pick<DatabaseJob, 'status' | 'endTime' | 'exitCode' | 'downloadCount' | 'skipCount'>
  >,
): Promise<void> {
  try {
    const now = getCurrentTimestamp();
    const setParts: string[] = [];
    const values: Array<string | number> = [];

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
