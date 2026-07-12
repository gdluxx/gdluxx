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
import type { JobOutput } from '$lib/server/jobs/jobManager';
import type { JobListItem, JobStatus, JobsSummary } from '$lib/types/jobs';
import type { OptionWithSource } from '$lib/types/command-form';
import { clientLogger as logger } from '$lib/client/logger';

export interface ClientJob {
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

interface ListParams {
  statuses: JobStatus[] | undefined;
  sort: 'time' | 'downloads';
  dir: 'asc' | 'desc';
}

const LIST_PAGE_SIZE = 50;
const TERMINAL_STATUSES: JobStatus[] = ['success', 'no_action', 'error'];

function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function zeroSummary(): JobsSummary {
  return {
    counts: { running: 0, success: 0, no_action: 0, error: 0, total: 0 },
    totals: { downloads: 0, skips: 0 },
    runningJobIds: [],
    recent: [],
  };
}

// Paginated job list (metadata only, no output transcripts)
let listJobs = $state<JobListItem[]>([]);
let listTotal = $state(0);
let listOffset = $state(0);
let listLoading = $state(false);
let listLoadingMore = $state(false);
let listParams = $state<ListParams>({ statuses: undefined, sort: 'time', dir: 'desc' });

// Cheap, always-fresh aggregate counts/totals for the whole job set
let summary = $state<JobsSummary>(zeroSummary());

// Full job records (with output) for jobs that are visible (modal open) or running
let detailJobs = $state<Record<string, ClientJob>>({});

let isJobListModalOpen = $state(false);

const visibleJobs = $derived(Object.values(detailJobs).filter((job) => job.isVisible));

const jobCount = $derived(summary.counts.total);
const runningJobCount = $derived(summary.counts.running);
const successJobCount = $derived(summary.counts.success);
const noActionJobCount = $derived(summary.counts.no_action);
const errorJobCount = $derived(summary.counts.error);
const totalDownloads = $derived(summary.totals.downloads);
const totalSkips = $derived(summary.totals.skips);
const hasMoreListJobs = $derived(listJobs.length < listTotal);

function buildListQuery(offset: number): string {
  const parts = [`limit=${LIST_PAGE_SIZE}`, `offset=${offset}`];
  if (listParams.statuses && listParams.statuses.length > 0) {
    parts.push(`status=${encodeURIComponent(listParams.statuses.join(','))}`);
  }
  parts.push(`sort=${listParams.sort}`, `dir=${listParams.dir}`);
  return `/api/jobs?${parts.join('&')}`;
}

async function loadListPage(reset: boolean): Promise<void> {
  if (!browser) {
    return;
  }
  if (reset) {
    if (listLoading) {
      return;
    }
    listLoading = true;
  } else {
    if (listLoadingMore || listLoading || listJobs.length >= listTotal) {
      return;
    }
    listLoadingMore = true;
  }

  const offset = reset ? 0 : listOffset;

  try {
    const response = await fetch(buildListQuery(offset));
    const payload = await response.json();
    if (payload.success && payload.data) {
      const { jobs: pageJobs, total } = payload.data as { jobs: JobListItem[]; total: number };
      if (reset) {
        listJobs = pageJobs;
      } else {
        const existingIds = new Set(listJobs.map((job) => job.id));
        const deduped = pageJobs.filter((job) => !existingIds.has(job.id));
        listJobs = [...listJobs, ...deduped];
      }
      listTotal = total;
      listOffset = listJobs.length;
    }
  } catch (error) {
    logger.error('Failed to load jobs list:', error);
  } finally {
    listLoading = false;
    listLoadingMore = false;
  }
}

function loadMore(): Promise<void> {
  return loadListPage(false);
}

function setStatusFilter(statuses: JobStatus[] | undefined): void {
  listParams = { ...listParams, statuses };
  void loadListPage(true);
}

function setSort(sort: 'time' | 'downloads', dir: 'asc' | 'desc'): void {
  listParams = { ...listParams, sort, dir };
  void loadListPage(true);
}

async function loadSummary(): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    const response = await fetch('/api/jobs/summary');
    const payload = await response.json();
    if (payload.success && payload.data) {
      summary = payload.data as JobsSummary;
    }
  } catch (error) {
    logger.error('Failed to load jobs summary:', error);
  }
}

function createClientJob(id: string, seed?: Partial<JobListItem>): ClientJob {
  return {
    id,
    url: seed?.url ?? '',
    status: seed?.status ?? 'running',
    output: [],
    startTime: seed?.startTime ?? Date.now(),
    endTime: seed?.endTime,
    exitCode: seed?.exitCode,
    downloadCount: seed?.downloadCount ?? 0,
    skipCount: seed?.skipCount ?? 0,
    batchCount: seed?.batchCount,
    isVisible: false,
    eventSource: undefined,
  };
}

function ensureDetailJob(id: string, seed?: Partial<JobListItem>): ClientJob {
  let job = detailJobs[id];
  if (!job) {
    job = createClientJob(id, seed);
    detailJobs[id] = job;
  }
  return job;
}

function findListRow(id: string): JobListItem | undefined {
  return listJobs.find((job) => job.id === id) ?? summary.recent.find((job) => job.id === id);
}

async function startJob(
  urls: string[],
  selectedOptions = new Map<string, OptionWithSource>(),
  excludedOptions: string[] = [],
): Promise<BatchJobStartResult> {
  if (!browser) {
    return {
      overallSuccess: false,
      results: urls.map((url) => ({
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
    const response: Response = await fetch('/api/command/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        args: optionsArray,
        excludedOptions,
      }),
    });

    const payload = await response.json();

    if (response.ok && payload.success && payload.data?.results) {
      const { overallSuccess, results } = payload.data as {
        overallSuccess: boolean;
        results: BatchUrlResult[];
      };
      let firstJobMadeVisible = false;

      for (const result of results) {
        if (result.success && result.jobId) {
          const startTime = Date.now();
          const newJob: ClientJob = {
            id: result.jobId,
            url: result.url,
            status: 'running',
            output: [],
            startTime,
            downloadCount: 0,
            skipCount: 0,
            isVisible: !firstJobMadeVisible,
            eventSource: undefined,
          };
          if (!firstJobMadeVisible) {
            firstJobMadeVisible = true;
          }
          detailJobs[newJob.id] = newJob;

          listJobs.unshift({
            id: newJob.id,
            url: newJob.url,
            status: newJob.status,
            startTime,
            downloadCount: 0,
            skipCount: 0,
          });
          listTotal += 1;
          listOffset += 1;

          summary.counts.running += 1;
          summary.counts.total += 1;
          summary.runningJobIds.push(newJob.id);

          setTimeout(() => connectToJob(newJob.id), 50);
        }
      }

      return { overallSuccess, results };
    } else {
      const errorMsg: string =
        payload.error ??
        (response.ok ? 'Batch job submission reported failure.' : `API Error: ${response.status}`);
      logger.error('Failed to start one or more jobs:', payload.data?.results ?? errorMsg);
      return {
        overallSuccess: false,
        results:
          payload.data?.results ??
          urls.map((url) => ({
            url,
            success: false,
            error: errorMsg || 'Unknown API error for this URL',
          })),
        error: payload.error,
      };
    }
  } catch (error) {
    logger.error('Network or parsing error starting jobs:', error);
    return {
      overallSuccess: false,
      results: urls.map((url) => ({
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Network/parsing error',
      })),
      error: error instanceof Error ? error.message : 'Network/parsing error',
    };
  }
}

function connectToJob(jobId: string, seed?: Partial<JobListItem>): void {
  if (!browser) {
    return;
  }

  const job = ensureDetailJob(jobId, seed);
  if (job.eventSource) {
    return;
  }

  const eventSource = new EventSource(`/api/command/stream/${jobId}`);
  job.eventSource = eventSource;

  eventSource.onopen = () => {
    logger.info(`EventSource connected for job ${jobId}`);
    fetchJobDetails(jobId).catch((e) =>
      logger.error(`Error fetching details for ${jobId} onopen:`, e),
    );
  };

  ['stdout', 'info', 'stderr', 'error', 'fatal', 'status'].forEach((eventType) => {
    eventSource.addEventListener(eventType, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        addOutput(jobId, eventType as JobOutput['type'], data);
      } catch {
        addOutput(jobId, eventType as JobOutput['type'], event.data);
      }
    });
  });

  // Listening for count updates
  eventSource.addEventListener('counts', (event: MessageEvent) => {
    try {
      const countData = JSON.parse(event.data);
      if (countData.downloadCount !== undefined && countData.skipCount !== undefined) {
        patchJobCounts(jobId, countData.downloadCount, countData.skipCount);
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
          updateJobStatus(
            jobId,
            status,
            parsedData.code,
            parsedData.downloadCount,
            parsedData.skipCount,
          );
          serverInitiatedProperClose = true;
        } else {
          logger.warn(
            `EventSource close event for job ${jobId} had data, but no 'code' field:`,
            parsedData,
          );
        }
      } else {
        logger.info(
          `EventSource close event for job ${jobId} had no data. Likely a client/browser initiated closure or network issue.`,
        );
      }
    } catch (e) {
      logger.warn(
        `Failed to parse close event data for job ${jobId}: '${event.data}'. Error: ${e}. Assuming client/browser initiated or abrupt closure.`,
      );
    }

    const currentJob = detailJobs[jobId];
    if (currentJob?.eventSource === eventSource) {
      currentJob.eventSource.close();
      currentJob.eventSource = undefined;
      logger.info(
        `Cleared eventSource for job ${jobId} after its close event (serverInitiatedProperClose: ${serverInitiatedProperClose}).`,
      );
    }
  });

  eventSource.onerror = (err) => {
    logger.error(`EventSource error for job ${jobId}:`, err);

    const currentJob = detailJobs[jobId];
    if (currentJob?.eventSource === eventSource && eventSource.readyState === EventSource.CLOSED) {
      logger.info(
        `EventSource for job ${jobId} is now CLOSED due to an error. Clearing reference.`,
      );
      currentJob.eventSource = undefined;
    }
  };
}

function addOutput(jobId: string, type: JobOutput['type'], data: string) {
  const job = detailJobs[jobId];
  if (!job) {
    return;
  }

  job.output.push({ type, data, timestamp: Date.now() });
  if (job.output.length > 10000) {
    job.output = job.output.slice(-10000);
  }
}

// Applies a count update (from an SSE 'counts' event) to the detail record,
// the matching list row (if loaded), and the running summary totals
function patchJobCounts(jobId: string, downloadCount?: number, skipCount?: number): void {
  if (downloadCount === undefined && skipCount === undefined) {
    return;
  }

  const job = detailJobs[jobId];
  const prevDownload = job?.downloadCount ?? 0;
  const prevSkip = job?.skipCount ?? 0;

  if (job) {
    if (downloadCount !== undefined) {
      job.downloadCount = downloadCount;
    }
    if (skipCount !== undefined) {
      job.skipCount = skipCount;
    }
  }

  const listRow = listJobs.find((row) => row.id === jobId);
  if (listRow) {
    if (downloadCount !== undefined) {
      listRow.downloadCount = downloadCount;
    }
    if (skipCount !== undefined) {
      listRow.skipCount = skipCount;
    }
  }

  const newDownload = downloadCount ?? prevDownload;
  const newSkip = skipCount ?? prevSkip;
  summary.totals.downloads += newDownload - prevDownload;
  summary.totals.skips += newSkip - prevSkip;
}

// Applies a terminal (or otherwise updated) status to the detail record, the
// matching list row (if loaded), and the summary counts/totals.
function updateJobStatus(
  jobId: string,
  status: JobStatus,
  exitCode?: number,
  downloadCount?: number,
  skipCount?: number,
): void {
  const job = detailJobs[jobId];
  const prevStatus = job?.status;
  const prevDownload = job?.downloadCount ?? 0;
  const prevSkip = job?.skipCount ?? 0;
  const endTime = Date.now();
  const terminal = isTerminalStatus(status);

  if (job) {
    job.status = status;
    if (exitCode !== undefined) {
      job.exitCode = exitCode;
    }
    if (downloadCount !== undefined) {
      job.downloadCount = downloadCount;
    }
    if (skipCount !== undefined) {
      job.skipCount = skipCount;
    }
    if (terminal) {
      job.endTime = endTime;
      if (job.eventSource) {
        if (job.eventSource.url.endsWith(jobId)) {
          job.eventSource.close();
        }
        job.eventSource = undefined;
      }
    }
  }

  const listRow = listJobs.find((row) => row.id === jobId);
  if (listRow) {
    listRow.status = status;
    if (exitCode !== undefined) {
      listRow.exitCode = exitCode;
    }
    if (downloadCount !== undefined) {
      listRow.downloadCount = downloadCount;
    }
    if (skipCount !== undefined) {
      listRow.skipCount = skipCount;
    }
    if (terminal) {
      listRow.endTime = endTime;
    }
  }

  if (terminal && prevStatus === 'running') {
    summary.counts.running = Math.max(0, summary.counts.running - 1);
    summary.counts[status] += 1;
    summary.runningJobIds = summary.runningJobIds.filter((id) => id !== jobId);

    const finalDownload = downloadCount ?? prevDownload;
    const finalSkip = skipCount ?? prevSkip;
    summary.totals.downloads += finalDownload - prevDownload;
    summary.totals.skips += finalSkip - prevSkip;
  }
}

async function fetchJobDetails(jobId: string) {
  if (!browser) {
    return;
  }

  try {
    const response = await fetch(`/api/command/job/${jobId}`);
    const payload = await response.json();
    const jobData = payload?.data?.job;
    if (payload.success && jobData) {
      const existingJob = detailJobs[jobId];
      if (existingJob) {
        existingJob.status = jobData.status;
        existingJob.output = jobData.output;
        existingJob.endTime = jobData.endTime;
        existingJob.exitCode = jobData.exitCode;
        existingJob.downloadCount = jobData.downloadCount ?? 0;
        existingJob.skipCount = jobData.skipCount ?? 0;
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
      const job = detailJobs[jobId];
      if (job?.eventSource) {
        job.eventSource.close();
      }
      if (jobId in detailJobs) {
        const { [jobId]: _removed, ...rest } = detailJobs;
        detailJobs = rest;
      }

      const wasListed = listJobs.some((row) => row.id === jobId);
      if (wasListed) {
        listJobs = listJobs.filter((row) => row.id !== jobId);
        listOffset = listJobs.length;
      }
      listTotal = Math.max(0, listTotal - 1);

      void loadSummary();
    }
  } catch (error) {
    logger.error('Failed to delete job:', error);
  }
}

async function deleteJobsBulk(ids: string[]): Promise<void> {
  if (!browser || ids.length === 0) {
    return;
  }

  try {
    const response = await fetch('/api/jobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await response.json();
    if (data.success) {
      const idSet = new Set(ids);
      for (const id of ids) {
        detailJobs[id]?.eventSource?.close();
      }
      const remaining: Record<string, ClientJob> = {};
      for (const [key, value] of Object.entries(detailJobs)) {
        if (!idSet.has(key)) {
          remaining[key] = value;
        }
      }
      detailJobs = remaining;

      await Promise.all([loadSummary(), loadListPage(true)]);
    }
  } catch (error) {
    logger.error('Failed to delete jobs:', error);
  }
}

async function deleteAllJobs(): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    const response = await fetch('/api/jobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    const data = await response.json();
    if (data.success) {
      for (const job of Object.values(detailJobs)) {
        job.eventSource?.close();
      }
      detailJobs = {};

      await Promise.all([loadSummary(), loadListPage(true)]);
    }
  } catch (error) {
    logger.error('Failed to delete all jobs:', error);
  }
}

function reconnectToRunningJobs(): void {
  if (!browser) {
    return;
  }

  for (const id of summary.runningJobIds) {
    if (!detailJobs[id]?.eventSource) {
      connectToJob(id, findListRow(id));
    }
  }

  // Defensive: pick up any loaded rows marked running that the summary
  // snapshot hasn't caught up with yet.
  for (const row of listJobs) {
    if (row.status === 'running' && !detailJobs[row.id]?.eventSource) {
      connectToJob(row.id, row);
    }
  }
}

function initializeWithJobs(jobs: JobListItem[], total: number): void {
  listParams = { statuses: undefined, sort: 'time', dir: 'desc' };
  listJobs = jobs;
  listTotal = total;
  listOffset = jobs.length;

  loadSummary()
    .then(() => reconnectToRunningJobs())
    .catch((error) => logger.error('Failed to initialize jobs summary:', error));
}

function toggleJobVisibility(jobId: string) {
  const job = detailJobs[jobId];
  if (!job) {
    return;
  }
  if (job.isVisible) {
    hideJob(jobId);
  } else {
    showJob(jobId);
  }
}

function showJob(jobId: string) {
  const job = ensureDetailJob(jobId, findListRow(jobId));
  job.isVisible = true;

  if (job.status === 'running') {
    connectToJob(jobId);
  } else if (job.output.length === 0) {
    fetchJobDetails(jobId).catch((e) => logger.error(`Error fetching details for ${jobId}:`, e));
  }
}

function hideJob(jobId: string) {
  const job = detailJobs[jobId];
  if (!job) {
    return;
  }
  job.isVisible = false;

  if (job.status !== 'running') {
    const { [jobId]: _removed, ...rest } = detailJobs;
    detailJobs = rest;
  }
}

export const jobStore = {
  // Paginated list
  get listJobs() {
    return listJobs;
  },
  get listTotal() {
    return listTotal;
  },
  get listLoading() {
    return listLoading;
  },
  get listLoadingMore() {
    return listLoadingMore;
  },
  get hasMoreListJobs() {
    return hasMoreListJobs;
  },
  get listParams() {
    return listParams;
  },
  loadListPage,
  loadMore,
  setStatusFilter,
  setSort,

  // Summary
  get summary() {
    return summary;
  },
  loadSummary,

  // Actions
  startJob,
  deleteJob,
  deleteJobsBulk,
  deleteAllJobs,
  toggleJobVisibility,
  showJob,
  hideJob,
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
