/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import path from 'path';
import Database from 'better-sqlite3';
import { PATHS } from '$lib/server/constants';
import type { JobOutput } from '$lib/server/jobs/jobManager';
import { serverLogger } from '$lib/server/logger';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

function getCurrentTimestamp(): number {
  return Date.now();
}

export interface DatabaseJob {
  id: string;
  url: string;
  status: 'running' | 'success' | 'no_action' | 'error';
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  outputs: JobOutput[];
}

export async function readAllJobs(): Promise<DatabaseJob[]> {
  try {
    const jobsStmt = db.prepare('SELECT * FROM jobs ORDER BY startTime DESC');
    const jobRows = jobsStmt.all() as Array<{
      id: string;
      url: string;
      status: string;
      startTime: number;
      endTime?: number;
      exitCode?: number;
      downloadCount: number;
      skipCount: number;
    }>;

    const outputsStmt = db.prepare(`
      SELECT jobId, type, data, timestamp 
      FROM job_outputs 
      ORDER BY jobId, timestamp
    `);
    const outputRows = outputsStmt.all() as Array<{
      jobId: string;
      type: string;
      data: string;
      timestamp: number;
    }>;

    const outputsByJobId = new Map<string, JobOutput[]>();
    for (const output of outputRows) {
      if (!outputsByJobId.has(output.jobId)) {
        outputsByJobId.set(output.jobId, []);
      }
      const outputs = outputsByJobId.get(output.jobId);
      if (outputs) {
        outputs.push({
          type: output.type as JobOutput['type'],
          data: output.data,
          timestamp: output.timestamp,
        });
      }
    }

    // Combine jobs with their outputs
    return jobRows.map((job) => {
      const validStatuses = ['running', 'success', 'no_action', 'error'] as const;
      if (!validStatuses.includes(job.status as (typeof validStatuses)[number])) {
        serverLogger.error('Invalid job status found, defaulting to error', {
          invalidStatus: job.status,
          jobId: job.id,
        });
        job.status = 'error';
      }

      return {
        id: job.id,
        url: job.url,
        status: job.status as DatabaseJob['status'],
        startTime: job.startTime,
        endTime: job.endTime,
        exitCode: job.exitCode,
        downloadCount: job.downloadCount || 0,
        skipCount: job.skipCount || 0,
        outputs: outputsByJobId.get(job.id) || [],
      };
    });
  } catch (error) {
    serverLogger.error('Error reading jobs from database:', error);
    return [];
  }
}

export async function createJob(job: Omit<DatabaseJob, 'outputs'>): Promise<void> {
  try {
    const now = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO jobs (id, url, status, startTime, endTime, exitCode, downloadCount, skipCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      now,
      now,
    );
  } catch (error) {
    serverLogger.error('Error creating job in database:', error);
    throw new Error('Failed to create job.');
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
    throw new Error('Failed to update job.');
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
    throw new Error('Failed to add job output.');
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
    throw new Error('Failed to delete job.');
  }
}
