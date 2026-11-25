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
import {
  isActiveJobStatus,
  type JobListItem,
  type JobStatus,
  type JobsSummary,
} from '$lib/types/jobs';
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
  retryOfJobId?: string;
  retriedByJobId?: string;
  retryable: boolean;
  isVisible: boolean;
  eventSource?: EventSource;
}

export interface BatchUrlResult {
  jobId?: string;
  url: string;
  success: boolean;
  status?: 'waiting' | 'running';
  message?: string;
  error?: string;
}

export interface BatchJobStartResult {
  overallSuccess: boolean;
  results: BatchUrlResult[];
  error?: string;
}

export type RetryJobResult = { success: true; jobId: string } | { success: false; error: string };

export type RetryAllFailedJobsResult =
  | { success: true; total: number; accepted: number; failed: number }
  | { success: false; error: string };

interface NewJob {
  id: string;
  url: string;
  status: JobStatus;
  batchCount?: number;
  retryOfJobId?: string;
}

interface ListParams {
  statuses: JobStatus[] | undefined;
  sort: 'time' | 'downloads';
  dir: 'asc' | 'desc';
}

const LIST_PAGE_SIZE = 50;
const QUEUE_POLL_INTERVAL_MS = 3000;
const MAX_QUEUE_POLL_IDS = 100;

function zeroSummary(): JobsSummary {
  return {
    counts: { waiting: 0, running: 0, success: 0, no_action: 0, error: 0, total: 0 },
    totals: { downloads: 0, skips: 0 },
    retryableFailedCount: 0,
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

let queuePollTimer: ReturnType<typeof setTimeout> | undefined;

const visibleJobs = $derived(Object.values(detailJobs).filter((job) => job.isVisible));

const jobCount = $derived(summary.counts.total);
const runningJobCount = $derived(summary.counts.running);
const waitingJobCount = $derived(summary.counts.waiting);
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
      scheduleQueuePoll();
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
    retryOfJobId: seed?.retryOfJobId,
    retriedByJobId: seed?.retriedByJobId,
    retryable: seed?.retryable ?? false,
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

// Queued jobs get no live update connection, browsers cap connections per
// host, and a long queue would starve the page's other requests.
function addNewJob(newJob: NewJob, isVisible: boolean): void {
  const startTime = Date.now();
  detailJobs[newJob.id] = {
    ...createClientJob(newJob.id, { ...newJob, startTime }),
    isVisible,
  };

  listJobs.unshift({
    id: newJob.id,
    url: newJob.url,
    status: newJob.status,
    startTime,
    downloadCount: 0,
    skipCount: 0,
    batchCount: newJob.batchCount,
    retryOfJobId: newJob.retryOfJobId,
    retryable: false,
  });
  listTotal += 1;
  listOffset += 1;

  summary.counts[newJob.status] += 1;
  summary.counts.total += 1;
  if (newJob.status === 'running') {
    summary.runningJobIds.push(newJob.id);
  }

  if (newJob.status === 'running' || isVisible) {
    setTimeout(() => connectToJob(newJob.id), 50);
  } else {
    scheduleQueuePoll();
  }
}

function markRetried(jobId: string, retriedByJobId: string): void {
  for (const target of [detailJobs[jobId], ...listJobs, ...summary.recent]) {
    if (target?.id === jobId) {
      target.retriedByJobId = retriedByJobId;
      target.retryable = false;
    }
  }
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
          addNewJob(
            { id: result.jobId, url: result.url, status: result.status ?? 'running' },
            !firstJobMadeVisible,
          );
          firstJobMadeVisible = true;
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

  eventSource.addEventListener('queue', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as { status?: JobStatus };
      if (data.status) {
        updateJobStatus(jobId, data.status);
      }
    } catch (error) {
      logger.warn(`Failed to parse queue status for job ${jobId}:`, error);
    }
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
          if (status === 'error') {
            // Only the server knows whether the failed job can be retried .
            void fetchJobDetails(jobId);
          }
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
  const terminal = !isActiveJobStatus(status);

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

  if (terminal && (prevStatus === 'running' || prevStatus === 'waiting')) {
    summary.counts[prevStatus] = Math.max(0, summary.counts[prevStatus] - 1);
    summary.counts[status] += 1;
    summary.runningJobIds = summary.runningJobIds.filter((id) => id !== jobId);

    const finalDownload = downloadCount ?? prevDownload;
    const finalSkip = skipCount ?? prevSkip;
    summary.totals.downloads += finalDownload - prevDownload;
    summary.totals.skips += finalSkip - prevSkip;
  }
  if (status === 'running' && prevStatus === 'waiting') {
    summary.counts.waiting = Math.max(0, summary.counts.waiting - 1);
    summary.counts.running += 1;
    summary.runningJobIds.push(jobId);
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
        existingJob.url = jobData.url;
        existingJob.startTime = jobData.startTime;
        existingJob.batchCount = jobData.batchCount;
        existingJob.status = jobData.status;
        existingJob.output = jobData.output;
        existingJob.endTime = jobData.endTime;
        existingJob.exitCode = jobData.exitCode;
        existingJob.downloadCount = jobData.downloadCount ?? 0;
        existingJob.skipCount = jobData.skipCount ?? 0;
        existingJob.retryOfJobId = jobData.retryOfJobId;
        existingJob.retriedByJobId = jobData.retriedByJobId;
        existingJob.retryable = jobData.retryable ?? false;
      }
      const listRow = listJobs.find((row) => row.id === jobId);
      if (listRow) {
        listRow.retriedByJobId = jobData.retriedByJobId;
        listRow.retryable = jobData.retryable ?? false;
      }
    }
  } catch (error) {
    logger.error(`Failed to fetch job details for ${jobId}:`, error);
  }
}

async function retryJob(jobId: string): Promise<RetryJobResult> {
  if (!browser) {
    return { success: false, error: 'Cannot retry a job during SSR' };
  }
  try {
    const response = await fetch(`/api/command/job/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
    });
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.data?.jobId) {
      // A refused retry may have cleared the job's stored command. Refresh so Retry goes away.
      void fetchJobDetails(jobId);
      return { success: false, error: payload.error ?? 'Failed to retry job.' };
    }

    const { jobId: newJobId, status } = payload.data as { jobId: string; status: JobStatus };
    const source = detailJobs[jobId] ?? findListRow(jobId);
    addNewJob(
      {
        id: newJobId,
        url: source?.url ?? '',
        status,
        batchCount: source?.batchCount,
        retryOfJobId: jobId,
      },
      false,
    );
    markRetried(jobId, newJobId);
    void loadSummary();
    return { success: true, jobId: newJobId };
  } catch (error) {
    logger.error('Failed to retry job:', error);
    return { success: false, error: 'Failed to retry job.' };
  }
}

// Idempotent: a poll that raced a same-tab delete shouldn't lower listTotal twice.
function removeJobLocally(jobId: string): void {
  const job = detailJobs[jobId];
  const wasListed = listJobs.some((row) => row.id === jobId);
  if (!job && !wasListed) {
    return;
  }

  if (job?.eventSource) {
    job.eventSource.close();
  }
  if (job) {
    const { [jobId]: _removed, ...rest } = detailJobs;
    detailJobs = rest;
  }
  if (wasListed) {
    listJobs = listJobs.filter((row) => row.id !== jobId);
    listOffset = listJobs.length;
  }
  listTotal = Math.max(0, listTotal - 1);
}

async function deleteJob(jobId: string): Promise<void> {
  if (!browser) {
    return;
  }

  try {
    const response = await fetch(`/api/command/job/${jobId}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      removeJobLocally(jobId);
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

async function retryAllFailedJobs(): Promise<RetryAllFailedJobsResult> {
  if (!browser) {
    return { success: false, error: 'Cannot retry jobs during SSR' };
  }

  try {
    const response = await fetch('/api/jobs/retry-failed', { method: 'POST' });
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.data) {
      return { success: false, error: payload.error ?? 'Failed to retry failed jobs.' };
    }

    const { total, accepted, failed, results } = payload.data as {
      total: number;
      accepted: number;
      failed: number;
      results: Array<{ retryOfJobId: string; success: boolean; jobId?: string }>;
    };
    for (const result of results) {
      if (result.success && result.jobId) {
        markRetried(result.retryOfJobId, result.jobId);
      }
    }

    await Promise.all([loadSummary(), loadListPage(true)]);
    reconnectToRunningJobs();
    return { success: true, total, accepted, failed };
  } catch (error) {
    logger.error('Failed to retry all failed jobs:', error);
    return { success: false, error: 'Failed to retry failed jobs.' };
  }
}

function markStartedLocally(jobId: string): void {
  const job = detailJobs[jobId];
  if (job?.status === 'waiting') {
    job.status = 'running';
  }
  const listRow = listJobs.find((row) => row.id === jobId);
  if (listRow?.status === 'waiting') {
    listRow.status = 'running';
  }
}

function waitingJobIdsToPoll(): string[] {
  const ids = listJobs.filter((row) => row.status === 'waiting').map((row) => row.id);
  for (const job of Object.values(detailJobs)) {
    if (job.status === 'waiting' && !ids.includes(job.id)) {
      ids.push(job.id);
    }
  }
  return ids.filter((id) => !detailJobs[id]?.eventSource).slice(0, MAX_QUEUE_POLL_IDS);
}

function scheduleQueuePoll(): void {
  if (!browser || queuePollTimer || waitingJobIdsToPoll().length === 0) {
    return;
  }
  queuePollTimer = setTimeout(() => {
    void pollWaitingJobs().finally(() => {
      queuePollTimer = undefined;
      scheduleQueuePoll();
    });
  }, QUEUE_POLL_INTERVAL_MS);
}

// The summary poll is too slow to catch a queued job that starts and
// finishes between two polls, which would leave its row stuck on Waiting
async function pollWaitingJobs(): Promise<void> {
  const ids = waitingJobIdsToPoll();
  if (ids.length === 0) {
    return;
  }

  try {
    const params = new URLSearchParams({ ids: ids.join(','), limit: String(ids.length) });
    const response = await fetch(`/api/jobs?${params}`);
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.data) {
      return;
    }

    let changed = false;
    const rows = payload.data.jobs as JobListItem[];
    // Deleted elsewhere (another tab, "Delete all") or otherwise they'd be polled until reload.
    for (const id of ids) {
      if (!rows.some((row) => row.id === id)) {
        removeJobLocally(id);
        changed = true;
      }
    }
    for (const row of rows) {
      if (row.status === 'waiting') {
        continue;
      }
      changed = true;
      if (row.status === 'running') {
        markStartedLocally(row.id);
        connectToJob(row.id, row);
        continue;
      }
      updateJobStatus(row.id, row.status, row.exitCode, row.downloadCount, row.skipCount);
      const listRow = listJobs.find((item) => item.id === row.id);
      if (listRow) {
        Object.assign(listRow, row);
      }
    }
    if (changed) {
      void loadSummary();
    }
  } catch (error) {
    logger.error('Failed to poll waiting jobs:', error);
  }
}

function reconnectToRunningJobs(): void {
  if (!browser) {
    return;
  }

  for (const id of summary.runningJobIds) {
    markStartedLocally(id);
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

  scheduleQueuePoll();
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

  if (isActiveJobStatus(job.status)) {
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

  if (!isActiveJobStatus(job.status)) {
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
  retryJob,
  deleteJobsBulk,
  deleteAllJobs,
  retryAllFailedJobs,
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
  get waitingJobCount() {
    return waitingJobCount;
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
