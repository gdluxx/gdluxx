/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, setValue, removeValue } from './storage';

export const SENT_URLS_KEY = 'gdluxx_sent_urls';
export const JOB_RESULTS_KEY = 'gdluxx_job_results';

const MAX_SENT_HOSTS = 20;
const MAX_SENT_URLS_PER_HOST = 500;

export type SentStatus = 'sent' | 'success' | 'no_action' | 'error' | 'untracked';

export interface SentEntry {
  sentAt: number;
  status: SentStatus;
  jobId?: string;
}

export interface SentHostRecord {
  urls: Record<string, SentEntry>;
  savedAt: number;
}

type SentUrlsMap = Record<string, SentHostRecord>;

// Mirror of gdluxx_job_results element shape - jobTracker.ts CompletedJobResult
export interface JobResultEntry {
  jobId: string;
  url: string;
  status: 'success' | 'no_action' | 'error' | 'unknown' | 'untracked';
  downloadCount: number;
  skipCount: number;
  endTime?: number;
  batchId: string;
}

function normaliseHost(host: string): string {
  return host.trim().toLowerCase();
}

// recordSentUrls and reconcileWithJobResults both read-modify-write
// gdluxx_sent_urls; serializing them here, mirrors jobTracker.ts's
// enqueueMutation, prevents one from clobbering the other's write
let mutationQueue: Promise<unknown> = Promise.resolve();

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isSentStatus(value: unknown): value is SentStatus {
  return (
    value === 'sent' ||
    value === 'success' ||
    value === 'no_action' ||
    value === 'error' ||
    value === 'untracked'
  );
}

function cloneSentEntry(entry: unknown): SentEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as Partial<SentEntry>;
  if (typeof candidate.sentAt !== 'number' || !isSentStatus(candidate.status)) return null;
  return {
    sentAt: candidate.sentAt,
    status: candidate.status,
    jobId: typeof candidate.jobId === 'string' ? candidate.jobId : undefined,
  };
}

function cloneHostRecord(record: unknown): SentHostRecord | null {
  if (!record || typeof record !== 'object') return null;
  const candidate = record as Partial<SentHostRecord>;
  if (!candidate.urls || typeof candidate.urls !== 'object') return null;
  const urls: Record<string, SentEntry> = {};
  for (const [url, entry] of Object.entries(candidate.urls)) {
    const cloned = cloneSentEntry(entry);
    if (cloned) urls[url] = cloned;
  }
  return {
    urls,
    savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : Date.now(),
  };
}

async function loadSentUrlsMap(): Promise<SentUrlsMap> {
  try {
    const stored = await getValue<Record<string, unknown> | null>(SENT_URLS_KEY, null);
    if (!stored || typeof stored !== 'object') return {};
    const map: SentUrlsMap = {};
    for (const [host, record] of Object.entries(stored)) {
      const cloned = cloneHostRecord(record);
      if (cloned) map[host] = cloned;
    }
    return map;
  } catch (error) {
    console.error('Failed to load sent URL history', error);
    return {};
  }
}

function pruneSentUrlsMap(map: SentUrlsMap): void {
  const hostEntries = Object.entries(map);
  if (hostEntries.length <= MAX_SENT_HOSTS) return;
  hostEntries
    .sort(([, a], [, b]) => a.savedAt - b.savedAt)
    .slice(0, hostEntries.length - MAX_SENT_HOSTS)
    .forEach(([host]) => {
      delete map[host];
    });
}

function pruneHostUrls(record: SentHostRecord): void {
  const urlEntries = Object.entries(record.urls);
  if (urlEntries.length <= MAX_SENT_URLS_PER_HOST) return;
  urlEntries
    .sort(([, a], [, b]) => a.sentAt - b.sentAt)
    .slice(0, urlEntries.length - MAX_SENT_URLS_PER_HOST)
    .forEach(([url]) => {
      delete record.urls[url];
    });
}

export async function loadSentUrlsForHost(host: string): Promise<Record<string, SentEntry>> {
  const safeHost = normaliseHost(host);
  if (!safeHost) return {};
  const map = await loadSentUrlsMap();
  return map[safeHost]?.urls ?? {};
}

export async function recordSentUrls(
  host: string,
  accepted: Array<{ url: string; jobId?: string }>,
): Promise<void> {
  if (!accepted.length) return;
  const safeHost = normaliseHost(host);
  if (!safeHost) return;

  return enqueueMutation(async () => {
    try {
      const map = await loadSentUrlsMap();
      const record = map[safeHost] ?? { urls: {}, savedAt: Date.now() };
      const now = Date.now();
      for (const { url, jobId } of accepted) {
        record.urls[url] = { sentAt: now, status: 'sent', jobId };
      }
      record.savedAt = now;
      pruneHostUrls(record);
      map[safeHost] = record;
      pruneSentUrlsMap(map);
      await setValue(SENT_URLS_KEY, map);
    } catch (error) {
      console.error('Failed to record sent URL history', error);
    }
  });
}

export async function reconcileWithJobResults(host: string): Promise<boolean> {
  const safeHost = normaliseHost(host);
  if (!safeHost) return false;

  return enqueueMutation(async () => {
    try {
      const map = await loadSentUrlsMap();
      const record = map[safeHost];
      if (!record || Object.keys(record.urls).length === 0) return false;

      const jobResults = await getValue<JobResultEntry[]>(JOB_RESULTS_KEY, []);
      if (!Array.isArray(jobResults) || jobResults.length === 0) return false;

      // Feed is newest-first; first match per key wins.
      const byJobId = new Map<string, JobResultEntry>();
      const byUrl = new Map<string, JobResultEntry>();
      for (const entry of jobResults) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.jobId && !byJobId.has(entry.jobId)) byJobId.set(entry.jobId, entry);
        if (entry.url && !byUrl.has(entry.url)) byUrl.set(entry.url, entry);
      }

      let changed = false;
      for (const [url, sentEntry] of Object.entries(record.urls)) {
        // A known jobId is matched exclusively by jobId - falling back to a
        // URL match when that jobId isn't (yet) in the feed risks
        // attributing a different job's outcome to this entry.
        const match = sentEntry.jobId ? byJobId.get(sentEntry.jobId) : byUrl.get(url);
        if (!match || match.status === 'unknown' || match.status === sentEntry.status) continue;
        sentEntry.status = match.status;
        changed = true;
      }

      if (!changed) return false;

      record.savedAt = Date.now();
      map[safeHost] = record;
      await setValue(SENT_URLS_KEY, map);
      return true;
    } catch (error) {
      console.error('Failed to reconcile sent URL history', error);
      return false;
    }
  });
}

export async function clearSentHistory(host?: string): Promise<void> {
  try {
    if (host === undefined) {
      await removeValue(SENT_URLS_KEY);
      return;
    }
    const safeHost = normaliseHost(host);
    if (!safeHost) return;
    const map = await loadSentUrlsMap();
    if (!(safeHost in map)) return;
    delete map[safeHost];
    await setValue(SENT_URLS_KEY, map);
  } catch (error) {
    console.error('Failed to clear sent URL history', error);
  }
}
