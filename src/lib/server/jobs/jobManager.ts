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
  readJobsByIds,
  countJobs,
  readJobsSummary,
  readRunningJobIds,
  readWaitingJobs,
  readRetrySource,
  readRetryableFailedJobIds,
  createRetryJob,
  type JobsPageOptions,
} from './jobsManager';
import {
  isActiveJobStatus,
  type JobListItem,
  type JobStatus,
  type JobsSummary,
} from '$lib/types/jobs';
import { GALLERY_DL_MODE } from '$lib/server/galleryDlMode';
import { jobQueue } from './jobQueue';
import { parseQueuedExecution, type QueuedExecution } from './queuedExecution';

export interface JobOutput {
  type: 'info' | 'stdout' | 'stderr' | 'error' | 'fatal' | 'status';
  data: string;
  timestamp: number;
}

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  output: JobOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  batchCount?: number;
  retryOfJobId?: string;
  retriedByJobId?: string;
  retryable: boolean;
  process?: IPty;
  subscribers: Set<ReadableStreamDefaultController<Uint8Array>>;
}

export class RetryJobError extends Error {
  constructor(
    message: string,
    readonly statusCode: 404 | 409,
  ) {
    super(message);
    this.name = 'RetryJobError';
  }
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
    void this.initializationPromise.then(() => jobQueue.markReady()).catch(() => undefined);
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

      for (const queued of readWaitingJobs()) {
        this.hydrateActiveJob(queued.id);
      }
    } catch (error) {
      logger.warn('Error reconciling interrupted jobs on startup:', error);
    }
  }

  whenReady(): Promise<void> {
    return this.initializationPromise;
  }

  /** Loads a waiting or running job into memory; terminal jobs stay in the database. */
  private hydrateActiveJob(id: string): Job | undefined {
    const dbJob = readJobById(id);
    if (!dbJob || !isActiveJobStatus(dbJob.status)) {
      return undefined;
    }
    const job: Job = {
      id: dbJob.id,
      url: dbJob.url,
      status: dbJob.status,
      output: readJobOutputs(id),
      startTime: dbJob.startTime,
      downloadCount: dbJob.downloadCount,
      skipCount: dbJob.skipCount,
      batchCount: dbJob.batchCount,
      retryOfJobId: dbJob.retryOfJobId,
      retryable: false,
      subscribers: new Set(),
    };
    this.jobs.set(id, job);
    return job;
  }

  private createWaitingJob(url: string, batchCount?: number, retryOfJobId?: string): Job {
    return {
      id: uuidv4(),
      url,
      status: 'waiting',
      output: [],
      startTime: Date.now(),
      downloadCount: 0,
      skipCount: 0,
      batchCount,
      retryOfJobId,
      retryable: false,
      subscribers: new Set(),
    };
  }

  private enqueue(job: Job): void {
    this.jobs.set(job.id, job);
    logger.info(`Job queued: ${job.id} for URL: ${job.url}`);
    jobQueue.capacityChanged();
  }

  private broadcast(job: Job, event: string, data: unknown): void {
    const encoded = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    for (const controller of job.subscribers) {
      try {
        controller.enqueue(encoded);
      } catch (error) {
        logger.warn(`Error sending ${event} event to subscriber for job ${job.id}:`, error);
        job.subscribers.delete(controller);
      }
    }
  }

  async createQueuedJob(
    url: string,
    payload: QueuedExecution,
    batchCount?: number,
  ): Promise<string> {
    await this.initializationPromise;
    const job = this.createWaitingJob(url, batchCount);

    await dbCreateJob({
      id: job.id,
      url,
      status: 'waiting',
      startTime: job.startTime,
      downloadCount: 0,
      skipCount: 0,
      batchCount,
      queuePayload: JSON.stringify(payload),
    });

    this.enqueue(job);
    return job.id;
  }

  /** Replays the failed job's stored command as a new job; the failed job is left as is. */
  async retryJob(id: string): Promise<{ jobId: string; status: JobStatus }> {
    await this.initializationPromise;
    const source = readRetrySource(id);
    if (!source) {
      throw new RetryJobError('Job not found.', 404);
    }
    if (source.retriedByJobId) {
      throw new RetryJobError('This job has already been retried.', 409);
    }
    if (source.status !== 'error') {
      throw new RetryJobError('Only failed jobs can be retried.', 409);
    }
    if (!source.queuePayload) {
      throw new RetryJobError(
        'This job has no stored command to retry. Submit the URL again.',
        409,
      );
    }
    const parsed = parseQueuedExecution(source.queuePayload, GALLERY_DL_MODE);
    if (!parsed.ok) {
      await dbUpdateJob(id, { queuePayload: null });
      throw new RetryJobError(parsed.reason, 409);
    }

    const batchCount = source.batchCount ?? undefined;
    const job = this.createWaitingJob(source.url, batchCount, id);
    const created = createRetryJob({
      id: job.id,
      url: source.url,
      status: 'waiting',
      startTime: job.startTime,
      downloadCount: 0,
      skipCount: 0,
      batchCount,
      queuePayload: JSON.stringify(parsed.payload),
      retryOfJobId: id,
    });
    if (!created) {
      throw new RetryJobError('This job is no longer retryable.', 409);
    }

    this.enqueue(job);
    logger.info(`Job ${job.id} queued as a retry of ${id}`);
    return { jobId: job.id, status: job.status };
  }

  async getRetryableFailedJobIds(limit: number): Promise<string[]> {
    await this.initializationPromise;
    return readRetryableFailedJobIds(limit);
  }

  /** Only the queue calls this, and it starts after initialization. */
  markQueuedJobRunning(id: string, startTime: number): boolean {
    const job = this.jobs.get(id) ?? this.hydrateActiveJob(id);
    if (!job) {
      return false;
    }
    job.status = 'running';
    job.startTime = startTime;
    this.broadcast(job, 'queue', { status: 'running' });
    return true;
  }

  /** Never throws: the queue's failure paths rely on it. */
  async failJob(id: string, message: string, options?: { retryable?: boolean }): Promise<void> {
    await this.initializationPromise;
    if (!this.jobs.has(id) && !this.hydrateActiveJob(id)) {
      return;
    }
    await this.addOutput(id, 'error', message);
    await this.completeJob(id, 1, options);
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
      retryOfJobId: dbJob.retryOfJobId,
      retriedByJobId: dbJob.retriedByJobId,
      retryable: dbJob.retryable,
      subscribers: new Set(),
    };
  }

  async getJobsList(options: JobsPageOptions): Promise<{ jobs: JobListItem[]; total: number }> {
    await this.initializationPromise;
    const jobs = readJobsPage(options);
    const total = countJobs(options.statuses);
    return { jobs, total };
  }

  async getJobsByIds(ids: string[]): Promise<{ jobs: JobListItem[]; total: number }> {
    await this.initializationPromise;
    const jobs = readJobsByIds(ids);
    return { jobs, total: jobs.length };
  }

  async getJobsSummary(): Promise<JobsSummary> {
    await this.initializationPromise;
    return readJobsSummary();
  }

  // Returns false when the job was deleted before its process was attached.
  async setJobProcess(id: string, process: IPty): Promise<boolean> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (!job) {
      return false;
    }
    job.process = process;
    return true;
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

  // `retryable: false` drops a failed job's stored command, so it offers no Retry.
  async completeJob(
    id: string,
    exitCode: number,
    { retryable = true }: { retryable?: boolean } = {},
  ): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.endTime = Date.now();
      job.exitCode = exitCode;

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
          queuePayload: job.status === 'error' && retryable ? undefined : null,
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
      jobQueue.capacityChanged();
    }
  }

  async addSubscriber(
    id: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> {
    await this.initializationPromise;
    const encoder = new TextEncoder();
    const job: Job | undefined = this.jobs.get(id) ?? this.hydrateActiveJob(id);
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
      if (!isActiveJobStatus(job.status) && job.exitCode !== undefined) {
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

    // Not in memory and not active: the job was completed and evicted (or
    // predates this process). Replay its persisted output, then close.
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
    if (!isActiveJobStatus(dbJob.status)) {
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
      if (!isActiveJobStatus(job.status) && job.subscribers.size === 0) {
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
    jobQueue.capacityChanged();
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
      if (deletedCount) {
        jobQueue.capacityChanged();
      }
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
      if (deletedCount) {
        jobQueue.capacityChanged();
      }
      return deletedCount;
    } catch (error) {
      logger.warn('Failed to delete all jobs from database:', error);
      return 0;
    }
  }
}

export const jobManager = new JobManager();
