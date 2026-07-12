/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { v4 as uuidv4 } from 'uuid';
import { serverLogger as logger } from '$lib/server/logger';
import {
  createJob as dbCreateJob,
  updateJob as dbUpdateJob,
  addJobOutput as dbAddJobOutput,
  deleteJob as dbDeleteJob,
  deleteJobs as dbDeleteJobs,
  deleteAllJobs as dbDeleteAllJobs,
  readJobById,
  readJobOutputs,
  readJobsPage,
  countJobs,
  readJobsSummary,
  readRunningJobIds,
  type JobsPageOptions,
} from './jobsManager';
import type { JobListItem, JobsSummary } from '$lib/types/jobs';

export interface JobOutput {
  type: 'info' | 'stdout' | 'stderr' | 'error' | 'fatal' | 'status';
  data: string;
  timestamp: number;
}

export interface Job {
  id: string;
  url: string;
  status: 'running' | 'success' | 'no_action' | 'error';
  output: JobOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  batchCount?: number;
  process?: IPty;
  subscribers: Set<ReadableStreamDefaultController<Uint8Array>>;
}

class JobManager {
  private jobs = new Map<string, Job>();
  private readonly MAX_OUTPUT_LINES: number = 10000;
  private readonly initializationPromise: Promise<void>;

  private parseGalleryDlOutput(data: string, job: Job): void {
    const lines: string[] = data.split('\n');

    for (const line of lines) {
      // Remove ANSI escape codes
      // eslint-disable-next-line no-control-regex
      const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '').trim();

      if (cleanLine.startsWith('✔ ')) {
        job.downloadCount++;
      }
      if (cleanLine.startsWith('# ')) {
        job.skipCount++;
      }
    }
  }

  constructor() {
    this.initializationPromise = this.loadJobsInternal()
      .then(() => {
        logger.info('Jobs loaded successfully during initialization');
      })
      .catch((error) => {
        logger.error('Failed to load jobs during initialization:', error);
        throw error;
      });
  }

  private async loadJobsInternal(): Promise<void> {
    // The in-memory map starts EMPTY and only ever holds jobs created during
    // this process's lifetime. Historical jobs are read from the database on
    // demand. On startup we only reconcile jobs left in a 'running' state by a
    // previous process (interrupted by a server restart).
    try {
      const interruptedIds = readRunningJobIds();

      for (const id of interruptedIds) {
        const timestamp = Date.now();
        await dbUpdateJob(id, {
          status: 'error',
          endTime: timestamp,
        });
        await dbAddJobOutput(id, {
          type: 'error',
          data: 'Job was interrupted by server restart',
          timestamp,
        });
      }

      if (interruptedIds.length > 0) {
        logger.info(`Reconciled ${interruptedIds.length} interrupted job(s) after server restart`);
      }
    } catch (error) {
      logger.warn('Error reconciling interrupted jobs on startup:', error);
    }
  }

  async createJob(url: string): Promise<string> {
    await this.initializationPromise;
    const id = uuidv4();
    const startTime = Date.now();
    const job: Job = {
      id,
      url,
      status: 'running',
      output: [],
      startTime,
      downloadCount: 0,
      skipCount: 0,
      subscribers: new Set(),
    };

    await dbCreateJob({
      id,
      url,
      status: 'running',
      startTime,
      downloadCount: 0,
      skipCount: 0,
    });

    this.jobs.set(id, job);
    logger.info(`Job created: ${id} for URL: ${url}`);
    return id;
  }

  async createBatchJob(urls: string[]): Promise<string> {
    await this.initializationPromise;
    const id = uuidv4();
    const startTime = Date.now();
    const job: Job = {
      id,
      url: 'directlink batch',
      status: 'running',
      output: [],
      startTime,
      downloadCount: 0,
      skipCount: 0,
      batchCount: urls.length,
      subscribers: new Set(),
    };

    await dbCreateJob({
      id,
      url: 'directlink batch',
      status: 'running',
      startTime,
      downloadCount: 0,
      skipCount: 0,
      batchCount: urls.length,
    });

    this.jobs.set(id, job);
    logger.info(`Batch job created: ${id} for ${urls.length} URL(s)`);
    return id;
  }

  async getJob(id: string): Promise<Job | undefined> {
    await this.initializationPromise;
    const inMemory = this.jobs.get(id);
    if (inMemory) {
      return inMemory;
    }

    // Fall back to the database for completed/evicted jobs. The reconstructed
    // job is NOT inserted into the map and carries no process handle.
    const dbJob = readJobById(id);
    if (!dbJob) {
      return undefined;
    }
    return {
      id: dbJob.id,
      url: dbJob.url,
      status: dbJob.status,
      output: readJobOutputs(id),
      startTime: dbJob.startTime,
      endTime: dbJob.endTime,
      exitCode: dbJob.exitCode,
      downloadCount: dbJob.downloadCount,
      skipCount: dbJob.skipCount,
      batchCount: dbJob.batchCount,
      subscribers: new Set(),
    };
  }

  async getJobsList(options: JobsPageOptions): Promise<{ jobs: JobListItem[]; total: number }> {
    await this.initializationPromise;
    const jobs = readJobsPage(options);
    const total = countJobs(options.statuses);
    return { jobs, total };
  }

  async getJobsSummary(): Promise<JobsSummary> {
    await this.initializationPromise;
    return readJobsSummary();
  }

  async setJobProcess(id: string, process: IPty): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.process = process;
    }
  }

  async addOutput(id: string, type: JobOutput['type'], data: string): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (!job) {
      return;
    }
    const output: JobOutput = { type, data, timestamp: Date.now() };
    job.output.push(output);
    if (job.output.length > this.MAX_OUTPUT_LINES) {
      job.output = job.output.slice(-this.MAX_OUTPUT_LINES);
    }

    // parse output for download and skip counts
    if (type === 'stdout' || type === 'stderr') {
      const previousDownloadCount = job.downloadCount;
      const previousSkipCount = job.skipCount;

      this.parseGalleryDlOutput(data, job);

      try {
        await dbUpdateJob(id, {
          downloadCount: job.downloadCount,
          skipCount: job.skipCount,
        });
      } catch (error) {
        logger.warn(`Failed to update job counts in database for job ${id}:`, error);
      }

      // Send count updates to subscribers if counts updated
      if (job.downloadCount !== previousDownloadCount || job.skipCount !== previousSkipCount) {
        const encoder = new TextEncoder();
        const countUpdateData = `event: counts\ndata: ${JSON.stringify({
          downloadCount: job.downloadCount,
          skipCount: job.skipCount,
        })}\n\n`;

        for (const controller of job.subscribers) {
          try {
            controller.enqueue(encoder.encode(countUpdateData));
          } catch (error) {
            logger.warn(`Error sending count update to subscriber for job ${id}:`, error);
            job.subscribers.delete(controller);
          }
        }
      }
    }

    try {
      await dbAddJobOutput(id, output);
    } catch (error) {
      logger.warn(`Failed to save job output to database for job ${id}:`, error);
    }

    const encoder = new TextEncoder();
    const eventData = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const controller of job.subscribers) {
      try {
        controller.enqueue(encoder.encode(eventData));
      } catch (error) {
        logger.warn(`Error adding to subscriber for job ${id}, removing subscriber:`, error);
        job.subscribers.delete(controller);
      }
    }
  }

  async completeJob(id: string, exitCode: number): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.endTime = Date.now();
      job.exitCode = exitCode;

      // Get status based on exit code and download counts
      if (exitCode === 0) {
        if (job.downloadCount > 0) {
          job.status = 'success';
        } else {
          job.status = 'no_action';
        }
      } else {
        job.status = 'error';
      }

      try {
        await dbUpdateJob(id, {
          status: job.status,
          endTime: job.endTime,
          exitCode: job.exitCode,
          downloadCount: job.downloadCount,
          skipCount: job.skipCount,
        });
      } catch (error) {
        logger.warn(`Failed to update job completion in database for job ${id}:`, error);
      }

      logger.info(`Job ${id} completed with exit code: ${exitCode}, status: ${job.status}`);
      for (const controller of job.subscribers) {
        try {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `event: close\ndata: ${JSON.stringify({
                code: exitCode,
                status: job.status,
                downloadCount: job.downloadCount,
                skipCount: job.skipCount,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          logger.warn(`Error closing subscriber for job ${id}:`, error);
        }
      }
      job.subscribers.clear();

      // The job is fully persisted; evict it from memory. Later reads are
      // served by the getJob / addSubscriber database fallbacks.
      this.jobs.delete(id);
    }
  }

  async addSubscriber(
    id: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    await this.initializationPromise;
    const encoder = new TextEncoder();
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.subscribers.add(controller);
      logger.info(`Subscriber added to job ${id}. Total subscribers: ${job.subscribers.size}`);
      for (const output of job.output) {
        try {
          const eventData = `event: ${output.type}\ndata: ${JSON.stringify(output.data)}\n\n`;
          controller.enqueue(encoder.encode(eventData));
        } catch (error) {
          logger.warn(`Error sending existing output to new subscriber for job ${id}:`, error);
          job.subscribers.delete(controller);
          break;
        }
      }
      if (job.status !== 'running' && job.exitCode !== undefined) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: close\ndata: ${JSON.stringify({
                code: job.exitCode,
                status: job.status,
                downloadCount: job.downloadCount,
                skipCount: job.skipCount,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          logger.warn(
            `Error sending close event to new subscriber for completed job ${id}:`,
            error,
          );
          job.subscribers.delete(controller);
        }
      }
      return;
    }

    // Not in memory: the job was completed and evicted (or predates this
    // process). Replay its persisted output from the database, then close.
    const dbJob = readJobById(id);
    if (!dbJob) {
      return;
    }
    const outputs = readJobOutputs(id);
    for (const output of outputs) {
      try {
        const eventData = `event: ${output.type}\ndata: ${JSON.stringify(output.data)}\n\n`;
        controller.enqueue(encoder.encode(eventData));
      } catch (error) {
        logger.warn(`Error replaying persisted output to subscriber for job ${id}:`, error);
        return;
      }
    }
    if (dbJob.status !== 'running') {
      try {
        controller.enqueue(
          encoder.encode(
            `event: close\ndata: ${JSON.stringify({
              code: dbJob.exitCode ?? 0,
              status: dbJob.status,
              downloadCount: dbJob.downloadCount,
              skipCount: dbJob.skipCount,
            })}\n\n`,
          ),
        );
        controller.close();
      } catch (error) {
        logger.warn(`Error sending close event to subscriber for persisted job ${id}:`, error);
      }
    }
  }

  async removeSubscriber(
    id: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.subscribers.delete(controller);
      logger.info(`Subscriber removed from job ${id}. Total subscribers: ${job.subscribers.size}`);

      // A completed job with no remaining subscribers is fully persisted and
      // can be evicted; later reads use the getJob / addSubscriber DB fallbacks.
      if (job.status !== 'running' && job.subscribers.size === 0) {
        this.jobs.delete(id);
        logger.info(`Evicted completed job ${id} from memory`);
      }
    }
  }

  private terminateInMemoryJob(job: Job): void {
    if (job.process && job.status === 'running') {
      try {
        job.process.kill();
        logger.info(`Killed process for job ${job.id}`);
      } catch (error) {
        logger.error(`Failed to kill process for job ${job.id}:`, error);
      }
    }
    for (const controller of job.subscribers) {
      try {
        controller.close();
      } catch (error) {
        logger.warn(`Error closing subscriber during job ${job.id} deletion:`, error);
      }
    }
  }

  async deleteJob(id: string): Promise<boolean> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      this.terminateInMemoryJob(job);
      this.jobs.delete(id);
    }

    let deletedFromDb = false;
    try {
      deletedFromDb = await dbDeleteJob(id);
    } catch (error) {
      logger.warn(`Failed to delete job from database for job ${id}:`, error);
    }

    if (!job && !deletedFromDb) {
      return false;
    }

    logger.info(`Job ${id} deleted.`);
    return true;
  }

  async deleteJobs(ids: string[]): Promise<number> {
    await this.initializationPromise;
    for (const id of ids) {
      const job = this.jobs.get(id);
      if (job) {
        this.terminateInMemoryJob(job);
        this.jobs.delete(id);
      }
    }

    try {
      const deletedCount = dbDeleteJobs(ids);
      logger.info(`Deleted ${deletedCount} job(s).`);
      return deletedCount;
    } catch (error) {
      logger.warn('Failed to bulk delete jobs from database:', error);
      return 0;
    }
  }

  async deleteAllJobs(): Promise<number> {
    await this.initializationPromise;
    for (const job of this.jobs.values()) {
      this.terminateInMemoryJob(job);
    }
    this.jobs.clear();

    try {
      const deletedCount = dbDeleteAllJobs();
      logger.info(`Deleted all ${deletedCount} job(s).`);
      return deletedCount;
    } catch (error) {
      logger.warn('Failed to delete all jobs from database:', error);
      return 0;
    }
  }
}

export const jobManager = new JobManager();
