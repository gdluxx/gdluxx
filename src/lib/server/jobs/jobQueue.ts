import { getSharedDatabase } from '$lib/server/database';
import { serverLogger as logger } from '$lib/server/logger';
import { jobQueueSettingsManager } from '$lib/server/jobQueueSettings';
import { readWaitingJobs, updateJob } from './jobsManager';

export interface QueuedExecution {
  kind: 'single' | 'batch';
  url: string;
  urls?: string[];
  cliArgs: string[];
  options?: { fallbackUrls?: string[]; fallbackCliArgs?: string[]; fallbackDiagnostic?: string; cookieUrl?: string };
}

type Runner = (id: string, payload: QueuedExecution, startTime: number) => Promise<void>;

const db = getSharedDatabase();
let runner: Runner | undefined;
let ready = false;
let draining = false;
let drainAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function hostsFor(payload: QueuedExecution): string[] {
  const urls = payload.kind === 'batch' ? payload.urls ?? [] : [payload.url];
  const hosts = new Set<string>();
  for (const url of urls) {
    try {
      hosts.add(new URL(url).hostname.toLowerCase().replace(/\.$/, ''));
    } catch {
      // Invalid URLs are rejected before queue admission. Keep them isolated if a
      // legacy/corrupt persisted descriptor is encountered.
      hosts.add('unknown');
    }
  }
  return [...hosts];
}

function readRunning(): Array<{ id: string; queuePayload: string | null }> {
  return db.prepare("SELECT id, queuePayload FROM jobs WHERE status = 'running'")
    .all() as Array<{ id: string; queuePayload: string | null }>;
}

function canStart(payload: QueuedExecution, running: Array<{ queuePayload: string | null }>, now: number): { eligible: boolean; waitMs: number } {
  const settings = jobQueueSettingsManager.read();
  if (running.length >= settings.maxConcurrent) return { eligible: false, waitMs: 0 };
  const hosts = hostsFor(payload);
  let waitMs = 0;
  for (const host of hosts) {
    const hostRunning = running.filter((job) => {
      try { return hostsFor(JSON.parse(job.queuePayload ?? '') as QueuedExecution).includes(host); }
      catch { return false; }
    }).length;
    if (settings.perHostEnabled && hostRunning >= settings.maxConcurrentPerHost) {
      return { eligible: false, waitMs: 0 };
    }
    const lastStarted = db.prepare('SELECT startedAt FROM job_queue_host_starts WHERE hostname = ?').get(host) as { startedAt: number } | undefined;
    if (settings.perHostEnabled && lastStarted && settings.sameHostDelayMs > 0) {
      const remaining = lastStarted.startedAt + settings.sameHostDelayMs - now;
      if (remaining > waitMs) waitMs = remaining;
    }
  }
  return { eligible: waitMs === 0, waitMs };
}

export const jobQueue = {
  registerRunner(nextRunner: Runner): void {
    runner = nextRunner;
    if (ready) void this.drain();
  },

  markReady(): void {
    ready = true;
    void this.drain();
  },

  async drain(): Promise<void> {
    if (!runner) return;
    if (draining) { drainAgain = true; return; }
    draining = true;
    try {
      do {
        drainAgain = false;
        const waiting = readWaitingJobs();
        const running = readRunning();
        const now = Date.now();
        let earliestWait = Number.POSITIVE_INFINITY;
        let selected: { id: string; payload: QueuedExecution; hosts: string[] } | undefined;
        for (const job of waiting) {
          let payload: QueuedExecution;
          try { payload = JSON.parse(job.queuePayload ?? '') as QueuedExecution; }
          catch (error) {
            logger.error(`Invalid persisted queue payload for job ${job.id}:`, error);
            await updateJob(job.id, { status: 'error', endTime: now, exitCode: 1, queuePayload: null });
            continue;
          }
          const eligibility = canStart(payload, running, now);
          if (eligibility.eligible) { selected = { id: job.id, payload, hosts: hostsFor(payload) }; break; }
          if (eligibility.waitMs > 0) earliestWait = Math.min(earliestWait, eligibility.waitMs);
        }
        if (selected) {
          const selectedJob = selected;
          const startedAt = Date.now();
          const reserve = db.prepare("UPDATE jobs SET status = 'running', startTime = ?, updatedAt = ? WHERE id = ? AND status = 'waiting'")
            .run(startedAt, startedAt, selectedJob.id);
          if (reserve.changes) {
            const writeStart = db.prepare('INSERT INTO job_queue_host_starts (hostname, startedAt) VALUES (?, ?) ON CONFLICT(hostname) DO UPDATE SET startedAt = excluded.startedAt');
            for (const host of selectedJob.hosts) writeStart.run(host, startedAt);
            running.push({ queuePayload: JSON.stringify(selectedJob.payload) });
            void runner(selectedJob.id, selectedJob.payload, startedAt).catch(async (error) => {
              logger.error(`Queued job ${selectedJob.id} failed to start:`, error);
              await updateJob(selectedJob.id, { status: 'error', endTime: Date.now(), exitCode: 1 });
              void this.drain();
            });
            drainAgain = true;
          }
        } else if (Number.isFinite(earliestWait)) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => { retryTimer = undefined; void this.drain(); }, Math.max(1, earliestWait));
        }
      } while (drainAgain);
    } finally {
      draining = false;
      if (drainAgain) void this.drain();
    }
  },

  capacityChanged(): void {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
    void this.drain();
  },
};
