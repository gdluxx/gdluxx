/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { browser } from '$app/environment';
import type { JobOutput, Job } from '$lib/server/jobs/jobManager';
import type { OptionWithSource } from '$lib/types/command-form';
import { clientLogger as logger } from '$lib/client/logger';

export interface ClientJob {
  id: string;
  url: string;
  status: 'running' | 'success' | 'no_action' | 'error';
  output: JobOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  isVisible: boolean;
  eventSource?: EventSource;
}

export interface BatchUrlResult {
  jobId?: string;
  url: string;
  success: boolean;
  message?: string;
  error?: string;
}

export interface BatchJobStartResult {
  overallSuccess: boolean;
  results: BatchUrlResult[];
  error?: string;
}

let jobs = $state<Record<string, ClientJob>>({});
let isJobListModalOpen = $state(false);

const visibleJobs = $derived(Object.values(jobs).filter(job => job.isVisible));
const jobCount = $derived(Object.keys(jobs).length);
const runningJobCount = $derived(
  Object.values(jobs).filter(job => job.status === 'running').length
);

const successJobCount = $derived(
  Object.values(jobs).filter(job => job.status === 'success').length
);

const noActionJobCount = $derived(
  Object.values(jobs).filter(job => job.status === 'no_action').length
);

const errorJobCount = $derived(Object.values(jobs).filter(job => job.status === 'error').length);

const totalDownloads = $derived(
  Object.values(jobs).reduce((sum, job) => sum + (job.downloadCount ?? 0), 0)
);

const totalSkips = $derived(
  Object.values(jobs).reduce((sum, job) => sum + (job.skipCount ?? 0), 0)
);

async function loadJobs(): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    const response: Response = await fetch('/jobs');
    const data = await response.json();
    if (data.success) {
      // Handle standardized API response format
      const jobsArray = data.data?.jobs ?? data.jobs ?? [];
      const jobMap: Record<string, ClientJob> = {};
      for (const job of jobsArray) {
        jobMap[job.id] = {
          ...job,
          isVisible: false,
          eventSource: undefined,
        };
      }

      jobs = jobMap;
    }
  } catch (error) {
    logger.error('Failed to load jobs:', error);
  }
}

async function startJob(
  urls: string[],
  selectedOptions = new Map<string, OptionWithSource>()
): Promise<BatchJobStartResult> {
  if (!browser) {
    return {
      overallSuccess: false,
      results: urls.map(url => ({
        url,
        success: false,
        error: 'Cannot start job during SSR',
      })),
    };
  }
  if (!urls || urls.length === 0) {
    return {
      overallSuccess: false,
      results: [],
    };
  }

  // Convert OptionWithSource map to key-value for API
  const optionsArray = Array.from(selectedOptions.entries()).map(([key, data]) => [
    key,
    typeof data === 'object' ? data.value : data,
  ]);

  try {
    const response: Response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        args: optionsArray,
      }),
    });

    const data: BatchJobStartResult = await response.json();

    if (response.ok && data.results) {
      let firstJobMadeVisible = false;

      for (const result of data.results) {
        if (result.success && result.jobId) {
          const newJob: ClientJob = {
            id: result.jobId,
            url: result.url,
            status: 'running',
            output: [],
            startTime: Date.now(),
            downloadCount: 0,
            skipCount: 0,
            isVisible: !firstJobMadeVisible,
            eventSource: undefined,
          };
          if (!firstJobMadeVisible) {
            firstJobMadeVisible = true;
          }
          jobs[newJob.id] = newJob;

          setTimeout(() => connectToJob(newJob.id), 50);
        }
      }

      jobs = { ...jobs };

      return { overallSuccess: data.overallSuccess, results: data.results };
    } else {
      const errorMsg: string =
        data.error ??
        (response.ok ? 'Batch job submission reported failure.' : `API Error: ${response.status}`);
      logger.error('Failed to start one or more jobs:', data.results || errorMsg);
      return {
        overallSuccess: false,
        results:
          data.results ||
          urls.map(url => ({
            url,
            success: false,
            error: errorMsg || 'Unknown API error for this URL',
          })),
        error: data.error,
      };
    }
  } catch (error) {
    logger.error('Network or parsing error starting jobs:', error);
    return {
      overallSuccess: false,
      results: urls.map(url => ({
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Network/parsing error',
      })),
      error: error instanceof Error ? error.message : 'Network/parsing error',
    };
  }
}

function connectToJob(jobId: string): void {
  if (!browser) {
    return;
  }

  const job = jobs[jobId];
  if (!job || job.eventSource) {
    return;
  }

  const eventSource = new EventSource(`/api/command/stream/${jobId}`);
  job.eventSource = eventSource;

  jobs = { ...jobs };

  eventSource.onopen = () => {
    logger.info(`EventSource connected for job ${jobId}`);
    fetchJobDetails(jobId).catch(e =>
      logger.error(`Error fetching details for ${jobId} onopen:`, e)
    );
  };

  ['stdout', 'info', 'stderr', 'error', 'fatal', 'status'].forEach(eventType => {
    eventSource.addEventListener(eventType, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        addOutput(jobId, eventType as JobOutput['type'], data);
      } catch {
        addOutput(jobId, eventType as JobOutput['type'], event.data);
      }
    });
  });

  // Listening for  count updates
  eventSource.addEventListener('counts', (event: MessageEvent) => {
    try {
      const countData = JSON.parse(event.data);
      const job = jobs[jobId];
      if (job && countData.downloadCount !== undefined && countData.skipCount !== undefined) {
        job.downloadCount = countData.downloadCount;
        job.skipCount = countData.skipCount;
        jobs = { ...jobs };
      }
    } catch (error) {
      logger.warn(`Failed to parse count update for job ${jobId}:`, error);
    }
  });

  eventSource.onmessage = (event: MessageEvent) => {
    addOutput(jobId, 'stdout', event.data);
  };

  eventSource.addEventListener('close', (event: MessageEvent) => {
    logger.info(`EventSource received close event for job ${jobId}. Event data: '${event.data}'`);

    let serverInitiatedProperClose = false;
    try {
      if (event.data) {
        const parsedData = JSON.parse(event.data);

        if (typeof parsedData.code === 'number') {
          // Fall back to exit code logic if server-determined status isn't available
          const status = parsedData.status ?? (parsedData.code === 0 ? 'success' : 'error');
          updateJobStatus(jobId, status, parsedData.code);

          const job = jobs[jobId];
          if (job && parsedData.downloadCount !== undefined) {
            job.downloadCount = parsedData.downloadCount;
          }
          if (job && parsedData.skipCount !== undefined) {
            job.skipCount = parsedData.skipCount;
          }

          serverInitiatedProperClose = true;
        } else {
          logger.warn(
            `EventSource close event for job ${jobId} had data, but no 'code' field:`,
            parsedData
          );
        }
      } else {
        logger.info(
          `EventSource close event for job ${jobId} had no data. Likely a client/browser initiated closure or network issue.`
        );
      }
    } catch (e) {
      logger.warn(
        `Failed to parse close event data for job ${jobId}: '${event.data}'. Error: ${e}. Assuming client/browser initiated or abrupt closure.`
      );
    }

    const currentJob = jobs[jobId];
    if (currentJob && currentJob.eventSource === eventSource) {
      currentJob.eventSource.close();
      currentJob.eventSource = undefined;
      logger.info(
        `Cleared eventSource for job ${jobId} after its close event (serverInitiatedProperClose: ${serverInitiatedProperClose}).`
      );
    }
  });

  eventSource.onerror = err => {
    logger.error(`EventSource error for job ${jobId}:`, err);

    const currentJob = jobs[jobId];
    if (
      currentJob &&
      currentJob.eventSource === eventSource &&
      eventSource.readyState === EventSource.CLOSED
    ) {
      logger.info(
        `EventSource for job ${jobId} is now CLOSED due to an error. Clearing reference.`
      );
      currentJob.eventSource = undefined;
    }
  };
}

function addOutput(jobId: string, type: JobOutput['type'], data: string) {
  const job = jobs[jobId];
  if (!job) {
    return;
  }

  job.output.push({ type, data, timestamp: Date.now() });
  if (job.output.length > 10000) {
    job.output = job.output.slice(-10000);
  }

  jobs = { ...jobs };
}

function updateJobStatus(jobId: string, status: ClientJob['status'], exitCode?: number) {
  const job = jobs[jobId];
  if (!job) {
    return;
  }

  job.status = status;
  if (exitCode !== undefined) {
    job.exitCode = exitCode;
  }
  if (status === 'success' || status === 'no_action' || status === 'error') {
    job.endTime = Date.now();
    if (job.eventSource) {
      if (job.eventSource.url.endsWith(jobId)) {
        job.eventSource.close();
      }
      job.eventSource = undefined;
    }
  }

  jobs = { ...jobs };
}

async function fetchJobDetails(jobId: string) {
  if (!browser) {
    return;
  }

  try {
    const response = await fetch(`/api/command/job/${jobId}`);
    const data = await response.json();
    if (data.success && data.job) {
      const existingJob = jobs[jobId];
      if (existingJob) {
        existingJob.status = data.job.status;
        existingJob.output = data.job.output;
        existingJob.endTime = data.job.endTime;
        existingJob.exitCode = data.job.exitCode;
        existingJob.downloadCount = data.job.downloadCount ?? 0;
        existingJob.skipCount = data.job.skipCount ?? 0;

        jobs = { ...jobs };
      }
    }
  } catch (error) {
    logger.error(`Failed to fetch job details for ${jobId}:`, error);
  }
}

async function deleteJob(jobId: string): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    const response = await fetch(`/api/command/job/${jobId}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      const job = jobs[jobId];
      if (job?.eventSource) {
        job.eventSource.close();
      }
      const { [jobId]: _, ...remainingJobs } = jobs;
      jobs = remainingJobs;
    }
  } catch (error) {
    logger.error('Failed to delete job:', error);
  }
}

function reconnectToRunningJobs(): void {
  if (!browser) {
    return;
  }

  for (const job of Object.values(jobs)) {
    if (job.status === 'running' && !job.eventSource) {
      logger.info(`Reconnecting to running job ${job.id}`);
      connectToJob(job.id);
    }
  }
}

let isInitialized = false;

function initializeWithJobs(serverJobs: Job[]): void {
  const jobRecord: Record<string, ClientJob> = {};
  for (const job of serverJobs) {
    jobRecord[job.id] = {
      ...job,
      isVisible: false,
      eventSource: undefined,
    };
  }
  jobs = jobRecord;
  isInitialized = true;

  setTimeout(reconnectToRunningJobs, 100);
}

if (browser) {
  setTimeout(() => {
    if (!isInitialized) {
      loadJobs().then(() => {
        setTimeout(reconnectToRunningJobs, 100);
      });
    }
  }, 50);
}

function toggleJobVisibility(jobId: string) {
  const job = jobs[jobId];
  if (job) {
    job.isVisible = !job.isVisible;

    jobs = { ...jobs };
  }
}

function showJob(jobId: string) {
  const job = jobs[jobId];
  if (job) {
    job.isVisible = true;

    jobs = { ...jobs };
  }
}

function hideJob(jobId: string) {
  const job = jobs[jobId];
  if (job) {
    job.isVisible = false;

    jobs = { ...jobs };
  }
}

export const jobStore = {
  get jobs() {
    return Object.values(jobs);
  },

  startJob,
  deleteJob,
  toggleJobVisibility,
  showJob,
  hideJob,
  loadJobs,
  reconnectToRunningJobs,
  initializeWithJobs,
  showJobListModal: () => {
    isJobListModalOpen = true;
  },
  hideJobListModal: () => {
    isJobListModalOpen = false;
  },
  toggleJobListModal: () => {
    isJobListModalOpen = !isJobListModalOpen;
  },

  get isJobListModalOpen() {
    return isJobListModalOpen;
  },
  get visibleJobs() {
    return visibleJobs;
  },
  get jobCount() {
    return jobCount;
  },
  get runningJobCount() {
    return runningJobCount;
  },

  // Enhanced status tracking getters
  get successJobCount() {
    return successJobCount;
  },
  get noActionJobCount() {
    return noActionJobCount;
  },
  get errorJobCount() {
    return errorJobCount;
  },
  get totalDownloads() {
    return totalDownloads;
  },
  get totalSkips() {
    return totalSkips;
  },
};
