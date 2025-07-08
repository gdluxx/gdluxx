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

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

function getCurrentTimestamp(): number {
  return Date.now();
}

export interface DatabaseJob {
  id: string;
  url: string;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  exitCode?: number;
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
    return jobRows.map(job => ({
      id: job.id,
      url: job.url,
      status: job.status as DatabaseJob['status'],
      startTime: job.startTime,
      endTime: job.endTime,
      exitCode: job.exitCode,
      outputs: outputsByJobId.get(job.id) || [],
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading jobs from database:', error);
    return [];
  }
}

export async function createJob(job: Omit<DatabaseJob, 'outputs'>): Promise<void> {
  try {
    const now = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO jobs (id, url, status, startTime, endTime, exitCode, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.url,
      job.status,
      job.startTime,
      job.endTime || null,
      job.exitCode || null,
      now,
      now
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating job in database:', error);
    throw new Error('Failed to create job.');
  }
}

export async function updateJob(
  jobId: string,
  updates: Partial<Pick<DatabaseJob, 'status' | 'endTime' | 'exitCode'>>
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
    // eslint-disable-next-line no-console
    console.error('Error updating job in database:', error);
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
    // eslint-disable-next-line no-console
    console.error('Error adding job output to database:', error);
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
    // eslint-disable-next-line no-console
    console.error('Error deleting job from database:', error);
    throw new Error('Failed to delete job.');
  }
}
