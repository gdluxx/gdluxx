/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import type { JobOutput, Job } from '$lib/server/jobManager';
import { logger } from '$lib/shared/logger';

export interface ClientJob {
  id: string;
  url: string;
  status: 'running' | 'completed' | 'error';
  output: JobOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
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

const _isJobListModalOpen: Writable<boolean> = writable(false);

function createJobStore() {
  const { subscribe, set, update } = writable<Map<string, ClientJob>>(new Map());

  async function loadJobs(): Promise<void> {
    if (!browser) {
      return;
    }
    try {
      const response: Response = await fetch('/api/command/jobs');
      const data = await response.json();
      if (data.success) {
        const jobMap = new Map<string, ClientJob>();
        for (const job of data.jobs) {
          jobMap.set(job.id, {
            ...job,
            isVisible: false,
            eventSource: undefined,
          });
        }
        set(jobMap);
      }
    } catch (error) {
      logger.error('Failed to load jobs:', error);
    }
  }

  async function startJob(
    urls: string[],
    useUserConfigPath = false,
    selectedOptions = new Map<string, string | number | boolean>()
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

    try {
      const response: Response = await fetch('/api/command/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({
          urls,
          useUserConfigPath,
          args: Array.from(selectedOptions.entries()),
        }),
      });

      const data: BatchJobStartResult = await response.json();

      if (response.ok && data.results) {
        // Make only first job is visible so we don't end up with multiple modals
        let firstJobMadeVisible = false;
        update(jobs => {
          for (const result of data.results) {
            if (result.success && result.jobId) {
              const newJob: ClientJob = {
                id: result.jobId,
                url: result.url,
                status: 'running',
                output: [],
                startTime: Date.now(),
                isVisible: !firstJobMadeVisible,
                eventSource: undefined,
              };
              if (!firstJobMadeVisible) {
                firstJobMadeVisible = true;
              }
              jobs.set(newJob.id, newJob);
              // Make sure EventSource is running before connecting
              setTimeout(() => connectToJob(newJob.id), 50);
            }
          }
          return jobs;
        });

        return { overallSuccess: data.overallSuccess, results: data.results };
      } else {
        const errorMsg: string =
          data.error ||
          (response.ok
            ? 'Batch job submission reported failure.'
            : `API Error: ${response.status}`);
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

    update(jobs => {
      const job = jobs.get(jobId);
      if (!job || job.eventSource) {
        return jobs;
      }

      const eventSource = new EventSource(`/api/command/stream/${jobId}`);
      job.eventSource = eventSource;

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

      eventSource.onmessage = (event: MessageEvent) => {
        addOutput(jobId, 'stdout', event.data);
      };

      eventSource.addEventListener('close', (event: MessageEvent) => {
        logger.info(
          `EventSource received close event for job ${jobId}. Event data: '${event.data}'`
        );

        let serverInitiatedProperClose = false;
        try {
          if (event.data) {
            const parsedData = JSON.parse(event.data);

            if (typeof parsedData.code === 'number') {
              updateJobStatus(
                jobId,
                parsedData.code === 0 ? 'completed' : 'error',
                parsedData.code
              );
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

        // clean up
        update(currentJobs => {
          const currentJob = currentJobs.get(jobId);

          if (currentJob && currentJob.eventSource === eventSource) {
            currentJob.eventSource.close();
            currentJob.eventSource = undefined;
            currentJobs.set(jobId, currentJob);
            logger.info(
              `Cleared eventSource for job ${jobId} after its close event (serverInitiatedProperClose: ${serverInitiatedProperClose}).`
            );
          }
          return currentJobs;
        });
      });

      eventSource.onerror = err => {
        logger.error(`EventSource error for job ${jobId}:`, err);

        update(currentJobs => {
          const currentJob = currentJobs.get(jobId);
          if (
            currentJob &&
            currentJob.eventSource === eventSource &&
            eventSource.readyState === EventSource.CLOSED
          ) {
            logger.info(
              `EventSource for job ${jobId} is now CLOSED due to an error. Clearing reference.`
            );
            currentJob.eventSource = undefined;
            currentJobs.set(jobId, currentJob);
          }
          return currentJobs;
        });
      };

      jobs.set(jobId, job);
      return jobs;
    });
  }

  function addOutput(jobId: string, type: JobOutput['type'], data: string) {
    update(jobs => {
      const job = jobs.get(jobId);
      if (!job) {
        return jobs;
      }
      job.output.push({ type, data, timestamp: Date.now() });
      if (job.output.length > 10000) {
        // MAX_OUTPUT_LINES
        job.output = job.output.slice(-10000);
      }
      jobs.set(jobId, job);
      return jobs;
    });
  }

  function updateJobStatus(jobId: string, status: ClientJob['status'], exitCode?: number) {
    update(jobs => {
      const job = jobs.get(jobId);
      if (!job) {
        return jobs;
      }
      job.status = status;
      if (exitCode !== undefined) {
        job.exitCode = exitCode;
      }
      if (status === 'completed' || status === 'error') {
        job.endTime = Date.now();
        if (job.eventSource) {
          if (job.eventSource.url.endsWith(jobId)) {
            job.eventSource.close();
          }
          job.eventSource = undefined;
        }
      }
      jobs.set(jobId, job);
      return jobs;
    });
  }

  async function fetchJobDetails(jobId: string) {
    if (!browser) {
      return;
    }
    try {
      const response = await fetch(`/api/command/job/${jobId}`);
      const data = await response.json();
      if (data.success && data.job) {
        update(jobs => {
          const existingJob = jobs.get(jobId);
          if (existingJob) {
            const updatedJob = {
              ...existingJob,
              ...data.job,
              isVisible: existingJob.isVisible,
              eventSource: existingJob.eventSource,
            };
            jobs.set(jobId, updatedJob);
          }
          return jobs;
        });
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
        update(jobs => {
          const job = jobs.get(jobId);
          if (job?.eventSource) {
            job.eventSource.close();
          }
          jobs.delete(jobId);
          return jobs;
        });
      }
    } catch (error) {
      logger.error('Failed to delete job:', error);
    }
  }

  function reconnectToRunningJobs(): void {
    if (!browser) {
      return;
    }
    subscribe(currentJobs => {
      for (const job of currentJobs.values()) {
        if (job.status === 'running' && !job.eventSource) {
          logger.info(`Reconnecting to running job ${job.id}`);
          connectToJob(job.id);
        }
      }
    })();
  }

  let isInitialized = false;

  function initializeWithJobs(serverJobs: Job[]): void {
    const jobMap = new Map<string, ClientJob>();
    for (const job of serverJobs) {
      jobMap.set(job.id, {
        ...job,
        isVisible: false,
        eventSource: undefined,
      });
    }
    set(jobMap);
    isInitialized = true;

    // Reconnect to any running jobs
    setTimeout(reconnectToRunningJobs, 100);
  }

  if (browser) {
    // Only auto-load if not initialized from server data
    setTimeout(() => {
      if (!isInitialized) {
        loadJobs().then(() => {
          setTimeout(reconnectToRunningJobs, 100);
        });
      }
    }, 50);
  }

  function toggleJobVisibility(jobId: string) {
    update(jobs => {
      const job = jobs.get(jobId);
      if (job) {
        job.isVisible = !job.isVisible;
        jobs.set(jobId, job);
      }
      return jobs;
    });
  }

  function showJob(jobId: string) {
    update(jobs => {
      const job = jobs.get(jobId);
      if (job) {
        job.isVisible = true;
        jobs.set(jobId, job);
      }
      return jobs;
    });
  }

  function hideJob(jobId: string) {
    update(jobs => {
      const job = jobs.get(jobId);
      if (job) {
        job.isVisible = false;
        jobs.set(jobId, job);
      }
      return jobs;
    });
  }

  function showJobListModal(): void {
    _isJobListModalOpen.set(true);
  }

  function hideJobListModal(): void {
    _isJobListModalOpen.set(false);
  }

  function toggleJobListModal(): void {
    _isJobListModalOpen.update(v => !v);
  }

  return {
    subscribe,
    startJob,
    deleteJob,
    toggleJobVisibility,
    showJob,
    hideJob,
    loadJobs, // Kept for explicit reload if needed
    reconnectToRunningJobs,
    initializeWithJobs,
    showJobListModal,
    hideJobListModal,
    toggleJobListModal,
    isJobListModalOpen: derived(_isJobListModalOpen, $isOpen => $isOpen),
  };
}

export const jobStore = createJobStore();

export const visibleJobs = derived(jobStore, $jobs =>
  Array.from($jobs.values()).filter(job => job.isVisible)
);
export const jobCount: Readable<number> = derived(jobStore, $jobs => $jobs.size);
export const runningJobCount = derived(
  jobStore,
  $jobs => Array.from($jobs.values()).filter(job => job.status === 'running').length
);
