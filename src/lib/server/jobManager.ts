import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '$lib/shared/logger';

export interface JobOutput {
  type: 'info' | 'stdout' | 'stderr' | 'error' | 'fatal' | 'status';
  data: string;
  timestamp: number;
}

export interface Job {
  id: string;
  url: string;
  status: 'running' | 'completed' | 'error';
  output: JobOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  useUserConfigPath: boolean;
  process?: IPty;
  subscribers: Set<ReadableStreamDefaultController<Uint8Array>>;
}

export interface SavedJob {
  id: string;
  url: string;
  status: 'running' | 'completed' | 'error';
  output: JobOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  useUserConfigPath: boolean;
}

class JobManager {
  private jobs = new Map<string, Job>();
  private readonly MAX_OUTPUT_LINES: number = 10000;
  private readonly JOBS_FILE: string = './data/jobs.json';
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.loadJobsInternal()
      .then(() => {
        logger.info('Jobs loaded successfully during initialization');
      })
      .catch(error => {
        logger.error('Failed to load jobs during initialization:', error);
        throw error;
      });
  }

  private async loadJobsInternal(): Promise<void> {
    try {
      const data = await fs.readFile(this.JOBS_FILE, 'utf-8');
      const savedJobs = JSON.parse(data);

      for (const [id, job] of Object.entries(savedJobs)) {
        const restoredJob = job as Job;
        restoredJob.subscribers = new Set();
        if (restoredJob.status === 'running') {
          restoredJob.status = 'error';
          restoredJob.output.push({
            type: 'error',
            data: 'Job was interrupted by server restart',
            timestamp: Date.now(),
          });
        }
        this.jobs.set(id, restoredJob);
      }
      logger.info('Jobs loaded successfully from', this.JOBS_FILE);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        logger.info('No existing jobs file found, starting fresh.');
      } else {
        logger.warn('Error loading jobs file, starting fresh:', error);
      }
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    // saveJobs is only called after initialization is complete
    this.saveTimer = setTimeout(async () => {
      try {
        await this.saveJobs();
      } catch (error) {
        logger.error('Error in scheduled saveJobs:', error);
      }
    }, 1000);
  }

  private async saveJobs(): Promise<void> {
    await this.initializationPromise; // jobs are loaded before saving
    try {
      const jobsToSave: Record<string, SavedJob> = {};
      for (const [id, job] of this.jobs.entries()) {
        const { process: _process, subscribers: _subscribers, ...jobData } = job;
        jobsToSave[id] = jobData;
      }
      await fs.mkdir(path.dirname(this.JOBS_FILE), { recursive: true });
      await fs.writeFile(this.JOBS_FILE, JSON.stringify(jobsToSave, null, 2));
      logger.debug('Jobs saved successfully to', this.JOBS_FILE);
    } catch (error) {
      logger.error('Failed to save jobs:', error);
      throw error;
    }
  }

  async createJob(url: string, useUserConfigPath: boolean): Promise<string> {
    await this.initializationPromise;
    const id = uuidv4();
    const job: Job = {
      id,
      url,
      status: 'running',
      output: [],
      startTime: Date.now(),
      useUserConfigPath,
      subscribers: new Set(),
    };
    this.jobs.set(id, job);
    logger.info(`Job created: ${id} for URL: ${url}`);
    this.scheduleSave();
    return id;
  }

  async getJob(id: string): Promise<Job | undefined> {
    await this.initializationPromise;
    return this.jobs.get(id);
  }

  async getAllJobs(): Promise<Job[]> {
    await this.initializationPromise;
    return Array.from(this.jobs.values()).map(job => {
      const { process: _process, subscribers: _subscribers, ...jobData } = job;
      return jobData as Job;
    });
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
    this.scheduleSave();
  }

  async completeJob(id: string, exitCode: number): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.status = exitCode === 0 ? 'completed' : 'error';
      job.endTime = Date.now();
      job.exitCode = exitCode;
      logger.info(`Job ${id} completed with exit code: ${exitCode}, status: ${job.status}`);
      for (const controller of job.subscribers) {
        try {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(`event: close\ndata: ${JSON.stringify({ code: exitCode })}\n\n`)
          );
          controller.close();
        } catch (error) {
          logger.warn(`Error closing subscriber for job ${id}:`, error);
        }
      }
      job.subscribers.clear();
      this.scheduleSave();
    }
  }

  async addSubscriber(
    id: string,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.subscribers.add(controller);
      logger.info(`Subscriber added to job ${id}. Total subscribers: ${job.subscribers.size}`);
      const encoder = new TextEncoder();
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
            encoder.encode(`event: close\ndata: ${JSON.stringify({ code: job.exitCode })}\n\n`)
          );
          controller.close();
        } catch (error) {
          logger.warn(
            `Error sending close event to new subscriber for completed job ${id}:`,
            error
          );
          job.subscribers.delete(controller);
        }
      }
    }
  }

  async removeSubscriber(
    id: string,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (job) {
      job.subscribers.delete(controller);
      logger.info(`Subscriber removed from job ${id}. Total subscribers: ${job.subscribers.size}`);
    }
  }

  async deleteJob(id: string): Promise<boolean> {
    await this.initializationPromise;
    const job: Job | undefined = this.jobs.get(id);
    if (!job) {
      return false;
    }
    if (job.process && job.status === 'running') {
      try {
        job.process.kill();
        logger.info(`Killed process for job ${id}`);
      } catch (error) {
        logger.error(`Failed to kill process for job ${id}:`, error);
      }
    }
    for (const controller of job.subscribers) {
      try {
        controller.close();
      } catch (error) {
        logger.warn(`Error closing subscriber during job ${id} deletion:`, error);
      }
    }
    this.jobs.delete(id);
    this.scheduleSave();
    logger.info(`Job ${id} deleted.`);
    return true;
  }
}

export const jobManager = new JobManager();
