/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import {
  proxyJobsGet,
  ensureHttpScheme,
  isEndpointAbsent,
  type BatchUrlResult,
  type JobStatusItem,
} from '#src/background/apiProxy';
import { expandJobResults } from '#src/shared/jobResults';
import { corroborateAndMarkAbsent } from '#src/background/serverCompatSync';
import { getServerCompat, isBlocked, mayAttempt } from '#src/shared/serverCompat';

export const ALARM_NAME = 'gdluxx-jobs-poll';
const PENDING_KEY = 'gdluxx_pending_jobs';
const RESULTS_KEY = 'gdluxx_job_results';
const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';
const MAX_BATCHES = 20;
const MAX_RESULTS = 500;
const BATCH_TTL_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 5 * 60_000;
const IDS_PER_REQUEST = 100;
const NOTIFICATION_PREFIX = 'gdluxx-batch-';
const UNSUPPORTED_NOTIFICATION_ID = 'gdluxx-jobs-unsupported';

interface PendingBatch {
  batchId: string;
  createdAt: number;
  updatedAt: number;
  sealed?: boolean;
  jobs: Array<{ jobId: string; url: string }>;
  tabUrl?: string;
}

interface CompletedJobResult {
  jobId: string;
  url: string;
  status: 'success' | 'no_action' | 'error' | 'unknown' | 'untracked';
  downloadCount: number;
  skipCount: number;
  endTime?: number;
  batchId: string;
}

let mutationQueue: Promise<unknown> = Promise.resolve();

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readPendingBatches(): Promise<PendingBatch[]> {
  const stored = await browser.storage.local.get(PENDING_KEY);
  const value = stored[PENDING_KEY];
  return Array.isArray(value) ? (value as PendingBatch[]) : [];
}

async function writePendingBatches(batches: PendingBatch[]): Promise<void> {
  await browser.storage.local.set({ [PENDING_KEY]: batches });
}

async function readCompletedResults(): Promise<CompletedJobResult[]> {
  const stored = await browser.storage.local.get(RESULTS_KEY);
  const value = stored[RESULTS_KEY];
  return Array.isArray(value) ? (value as CompletedJobResult[]) : [];
}

async function writeCompletedResults(results: CompletedJobResult[]): Promise<void> {
  await browser.storage.local.set({ [RESULTS_KEY]: results });
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function resultKey(entry: Pick<CompletedJobResult, 'batchId' | 'jobId' | 'url'>): string {
  return JSON.stringify([entry.batchId, entry.jobId, entry.url]);
}

function mergeCompletedResults(
  existing: CompletedJobResult[],
  newEntries: CompletedJobResult[],
): CompletedJobResult[] {
  const existingKeys = new Set(existing.map(resultKey));
  const deduped = newEntries.filter((entry) => !existingKeys.has(resultKey(entry)));
  return deduped.length > 0 ? [...deduped, ...existing].slice(0, MAX_RESULTS) : existing;
}

function jobsFromResults(
  results: BatchUrlResult[],
  inputUrls?: string[],
): Array<{ jobId: string; url: string }> {
  const expanded = inputUrls?.length ? expandJobResults(inputUrls, results) : results;
  return expanded
    .filter((result) => Boolean(result.jobId))
    .map((result) => ({ jobId: result.jobId as string, url: result.url }));
}

export async function recordPendingBatch(
  results: BatchUrlResult[],
  tabUrl?: string,
  batchId?: string,
  inputUrls?: string[],
  final?: boolean,
): Promise<void> {
  if (!mayAttempt(await getServerCompat(), 'jobs.polling')) {
    const jobs = jobsFromResults(results, inputUrls);
    if (jobs.length === 0) {
      return;
    }
    const now = Date.now();
    const resolvedBatchId = batchId ?? crypto.randomUUID();
    const untracked: CompletedJobResult[] = jobs.map((job) => ({
      jobId: job.jobId,
      url: job.url,
      status: 'untracked' as const,
      downloadCount: 0,
      skipCount: 0,
      endTime: now,
      batchId: resolvedBatchId,
    }));
    return enqueueMutation(async () => {
      const existingResults = await readCompletedResults();
      const merged = mergeCompletedResults(existingResults, untracked);
      if (merged !== existingResults) {
        await writeCompletedResults(merged);
      }
    });
  }

  return enqueueMutation(async () => {
    const jobs = jobsFromResults(results, inputUrls);

    if (jobs.length === 0) {
      return;
    }

    const pending = await readPendingBatches();
    const existingIndex = batchId ? pending.findIndex((batch) => batch.batchId === batchId) : -1;
    const now = Date.now();

    if (existingIndex >= 0) {
      const existing = pending[existingIndex];
      pending[existingIndex] = {
        ...existing,
        jobs: [...existing.jobs, ...jobs],
        updatedAt: now,
        sealed: existing.sealed || Boolean(final),
      };
    } else {
      pending.push({
        batchId: batchId ?? crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        sealed: Boolean(final),
        jobs,
        tabUrl,
      });
    }

    const trimmed =
      pending.length > MAX_BATCHES ? pending.slice(pending.length - MAX_BATCHES) : pending;
    await writePendingBatches(trimmed);

    await browser.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  });
}

export async function ensureAlarmIfPending(): Promise<void> {
  if (!mayAttempt(await getServerCompat(), 'jobs.polling')) {
    return;
  }
  const pending = await readPendingBatches();
  if (pending.length > 0) {
    await browser.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
}

function buildNotification(
  total: number,
  downloaded: number,
  skipped: number,
  failed: number,
  unknown: number,
): { title: string; message: string } {
  const title = failed > 0 ? `gdluxx Extension — ${failed} failed` : 'gdluxx Extension';

  let message = `${total} URL${total === 1 ? '' : 's'} done: ${downloaded} downloaded, ${skipped} skipped`;
  if (failed > 0) {
    message += `, ${failed} failed`;
  }
  if (unknown > 0) {
    message += `, ${unknown} unknown`;
  }

  return { title, message };
}

interface JobResolution {
  terminal: boolean;
  status: 'success' | 'no_action' | 'error' | 'unknown' | null;
  info?: JobStatusItem;
}

function resolveJobStatus(
  jobId: string,
  statusMap: Map<string, JobStatusItem>,
  fetchedIds: Set<string>,
): JobResolution {
  if (!fetchedIds.has(jobId)) {
    return { terminal: false, status: null };
  }
  const info = statusMap.get(jobId);
  if (!info) {
    return { terminal: true, status: 'unknown' };
  }
  if (info.status === 'running') {
    return { terminal: false, status: null };
  }
  return { terminal: true, status: info.status, info };
}

async function bailOutJobsPolling(): Promise<void> {
  await enqueueMutation(async () => {
    const pending = await readPendingBatches();
    const now = Date.now();

    const untracked: CompletedJobResult[] = pending.flatMap((batch) =>
      batch.jobs.map((job) => ({
        jobId: job.jobId,
        url: job.url,
        status: 'untracked' as const,
        downloadCount: 0,
        skipCount: 0,
        endTime: now,
        batchId: batch.batchId,
      })),
    );

    if (untracked.length > 0) {
      const existingResults = await readCompletedResults();
      const merged = mergeCompletedResults(existingResults, untracked);
      if (merged !== existingResults) {
        await writeCompletedResults(merged);
      }
    }

    await writePendingBatches([]);
    await browser.alarms.clear(ALARM_NAME);
  });

  try {
    await browser.notifications.create(UNSUPPORTED_NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icon/48.png',
      title: 'gdluxx Extension',
      message: "gdluxx server does not support job tracking — job status won't be reported",
    });
  } catch (error) {
    console.error('gdluxx: failed to show job-tracking-unsupported notification', error);
  }
}

export async function handleJobsAlarm(): Promise<void> {
  try {
    const compat = await getServerCompat();
    if (isBlocked(compat, 'jobs.polling')) {
      await bailOutJobsPolling();
      return;
    }

    const snapshot = await readPendingBatches();
    const allJobIds = Array.from(
      new Set(snapshot.flatMap((batch) => batch.jobs.map((j) => j.jobId))),
    );

    const statusMap = new Map<string, JobStatusItem>();
    const fetchedIds = new Set<string>();
    let jobsPollingConfirmedAbsent = false;

    if (allJobIds.length > 0) {
      const stored = await browser.storage.local.get([SERVER_URL_KEY, API_KEY_KEY]);
      const serverUrl = typeof stored[SERVER_URL_KEY] === 'string' ? stored[SERVER_URL_KEY] : '';
      const apiKey = typeof stored[API_KEY_KEY] === 'string' ? stored[API_KEY_KEY] : '';

      if (serverUrl && apiKey) {
        let corroborationAttempted = false;

        for (const ids of chunkIds(allJobIds, IDS_PER_REQUEST)) {
          const res = await proxyJobsGet(serverUrl, apiKey, ids);
          if (!res.success) {
            if (isEndpointAbsent(res) && !corroborationAttempted) {
              corroborationAttempted = true;
              const outcome = await corroborateAndMarkAbsent('jobs.polling', serverUrl, apiKey);
              if (outcome === 'confirmed-absent') {
                jobsPollingConfirmedAbsent = true;
                break;
              }
            }
            console.warn('gdluxx: job status fetch failed, retrying next tick', res.error);
            continue;
          }
          for (const id of ids) fetchedIds.add(id);
          for (const job of res.data?.jobs ?? []) {
            statusMap.set(job.id, job);
          }
        }
      }
      // No credentials: nothing gets fetched, batches simply wait for the next tick / TTL prune.
    }

    if (jobsPollingConfirmedAbsent) {
      await bailOutJobsPolling();
      return;
    }

    const notificationsToFire = await enqueueMutation(async () => {
      const now = Date.now();
      const pending = (await readPendingBatches()).filter((batch) => {
        const age = now - batch.createdAt;
        if (age > BATCH_TTL_MS) {
          console.warn(`gdluxx: dropping stale pending batch ${batch.batchId} (age ${age}ms)`);
          return false;
        }
        return true;
      });

      const remainingPending: PendingBatch[] = [];
      const newlyCompleted: CompletedJobResult[] = [];
      const toNotify: Array<{ id: string; title: string; message: string }> = [];

      for (const batch of pending) {
        const jobInfos = batch.jobs.map((job) => ({
          job,
          resolution: resolveJobStatus(job.jobId, statusMap, fetchedIds),
        }));
        const allTerminal = jobInfos.every(({ resolution }) => resolution.terminal);
        const updatedAt = batch.updatedAt ?? batch.createdAt;
        const readyToComplete = batch.sealed || now - updatedAt > GRACE_MS;

        if (!allTerminal || !readyToComplete) {
          remainingPending.push(batch);
          continue;
        }

        let downloaded = 0;
        let skipped = 0;
        let failed = 0;
        let unknown = 0;

        const countedJobIds = new Set<string>();

        for (const { job, resolution } of jobInfos) {
          const resolvedStatus = resolution.status ?? 'unknown';

          if (!countedJobIds.has(job.jobId)) {
            countedJobIds.add(job.jobId);
            downloaded += resolution.info?.downloadCount ?? 0;
            skipped += resolution.info?.skipCount ?? 0;
            if (resolvedStatus === 'error') failed++;
            if (resolvedStatus === 'unknown') unknown++;
          }

          newlyCompleted.push({
            jobId: job.jobId,
            url: job.url,
            status: resolvedStatus,
            downloadCount: resolution.info?.downloadCount ?? 0,
            skipCount: resolution.info?.skipCount ?? 0,
            endTime: resolution.info?.endTime,
            batchId: batch.batchId,
          });
        }

        const { title, message } = buildNotification(
          batch.jobs.length,
          downloaded,
          skipped,
          failed,
          unknown,
        );

        toNotify.push({ id: NOTIFICATION_PREFIX + batch.batchId, title, message });
      }

      if (newlyCompleted.length > 0) {
        const existingResults = await readCompletedResults();
        const merged = mergeCompletedResults(existingResults, newlyCompleted);
        if (merged !== existingResults) {
          await writeCompletedResults(merged);
        }
      }

      await writePendingBatches(remainingPending);

      if (remainingPending.length === 0) {
        await browser.alarms.clear(ALARM_NAME);
      }

      return toNotify;
    });

    for (const notification of notificationsToFire) {
      try {
        await browser.notifications.create(notification.id, {
          type: 'basic',
          iconUrl: 'icon/48.png',
          title: notification.title,
          message: notification.message,
        });
      } catch (error) {
        console.error('gdluxx: failed to show job-completion notification', error);
      }
    }
  } catch (error) {
    console.error('gdluxx: handleJobsAlarm failed', error);
  }
}

export async function handleNotificationClick(notificationId: string): Promise<void> {
  if (
    !notificationId.startsWith(NOTIFICATION_PREFIX) &&
    notificationId !== UNSUPPORTED_NOTIFICATION_ID
  ) {
    return;
  }

  const stored = await browser.storage.local.get(SERVER_URL_KEY);
  const serverUrl = typeof stored[SERVER_URL_KEY] === 'string' ? stored[SERVER_URL_KEY] : '';

  if (serverUrl) {
    await browser.tabs.create({ url: `${ensureHttpScheme(serverUrl).replace(/\/$/, '')}/jobs` });
  }

  await browser.notifications.clear(notificationId);
}
