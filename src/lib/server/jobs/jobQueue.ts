/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { serverLogger as logger } from '$lib/server/logger';
import { GALLERY_DL_MODE } from '$lib/server/galleryDlMode';
import type { GalleryDlMode } from '$lib/types/gallery-dl-mode';
import { readRunningPayloads, readWaitingJobs, reserveWaitingJob } from './jobsManager';
import { JOB_QUEUE_CONFIG, type JobQueueConfig } from './jobQueueConfig';
import {
  parseQueuedExecution,
  queuedExecutionHosts,
  type QueuedExecution,
} from './queuedExecution';

export interface JobQueueHandlers {
  start: (id: string, payload: QueuedExecution, startTime: number) => Promise<void>;
  fail: (id: string, message: string, retryable: boolean) => Promise<void>;
}

const START_FAILURE_MESSAGE = 'gdluxx could not start this job. Check the server logs for details.';

function runningHosts(rawPayload: string | null, policy: GalleryDlMode): string[] {
  const parsed = parseQueuedExecution(rawPayload, policy);
  return parsed.ok ? queuedExecutionHosts(parsed.payload) : [];
}

export function createJobQueue(config: JobQueueConfig, policy: GalleryDlMode) {
  let handlers: JobQueueHandlers | undefined;
  let ready = false;
  let draining = false;
  let drainAgain = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // Lost on restart, which is fine as nothing's running after a restart
  const lastStartByHost = new Map<string, number>();

  function msUntilStartable(hosts: string[], running: string[][], now: number): number | null {
    let waitMs = 0;
    for (const host of hosts) {
      if (config.maxConcurrentPerHost !== null) {
        const hostRunning = running.filter((jobHosts) => jobHosts.includes(host)).length;
        if (hostRunning >= config.maxConcurrentPerHost) {
          return null;
        }
      }
      const lastStart = lastStartByHost.get(host);
      if (config.sameHostDelayMs > 0 && lastStart !== undefined) {
        waitMs = Math.max(waitMs, lastStart + config.sameHostDelayMs - now);
      }
    }
    return waitMs;
  }

  function scheduleRetry(waitMs: number): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void queue.drain();
    }, waitMs);
  }

  function start(
    activeHandlers: JobQueueHandlers,
    id: string,
    payload: QueuedExecution,
    hosts: string[],
  ): void {
    const startTime = Date.now();
    if (!reserveWaitingJob(id, startTime)) {
      return;
    }
    for (const host of hosts) {
      lastStartByHost.set(host, startTime);
    }
    void activeHandlers.start(id, payload, startTime).catch(async (error) => {
      logger.error(`Queued job ${id} failed to start:`, error);
      await activeHandlers.fail(id, START_FAILURE_MESSAGE, true);
    });
  }

  /**
   * Starts at most one job. Returns whether another pass may start more.
   * Keep the path to the first start free of awaits. callers read a job's
   * status right after queueing it.
   */
  async function drainOnce(activeHandlers: JobQueueHandlers): Promise<boolean> {
    const running = readRunningPayloads().map((job) => runningHosts(job.queuePayload, policy));
    if (running.length >= config.maxConcurrent) {
      return false;
    }

    const now = Date.now();
    let earliestWaitMs: number | null = null;
    for (const job of readWaitingJobs()) {
      const parsed = parseQueuedExecution(job.queuePayload, policy);
      if (!parsed.ok) {
        logger.warn(`Refusing to start queued job ${job.id}: ${parsed.reason}`);
        await activeHandlers.fail(job.id, parsed.reason, false);
        continue;
      }

      const hosts = queuedExecutionHosts(parsed.payload);
      const waitMs = msUntilStartable(hosts, running, now);
      if (waitMs === 0) {
        start(activeHandlers, job.id, parsed.payload, hosts);
        return true;
      }
      if (waitMs !== null) {
        earliestWaitMs = Math.min(earliestWaitMs ?? waitMs, waitMs);
      }
    }

    if (earliestWaitMs !== null) {
      scheduleRetry(earliestWaitMs);
    }
    return false;
  }

  const queue = {
    registerHandlers(nextHandlers: JobQueueHandlers): void {
      handlers = nextHandlers;
      if (ready) {
        void queue.drain();
      }
    },

    markReady(): void {
      ready = true;
      void queue.drain();
    },

    async drain(): Promise<void> {
      const activeHandlers = handlers;
      if (!activeHandlers || !ready) {
        return;
      }
      if (draining) {
        drainAgain = true;
        return;
      }
      draining = true;
      try {
        do {
          drainAgain = false;
          try {
            drainAgain = (await drainOnce(activeHandlers)) || drainAgain;
          } catch (error) {
            logger.error('Job queue pass failed:', error);
          }
        } while (drainAgain);
      } finally {
        draining = false;
      }
    },

    capacityChanged(): void {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      void queue.drain();
    },
  };

  return queue;
}

export type JobQueue = ReturnType<typeof createJobQueue>;

export const jobQueue: JobQueue = createJobQueue(JOB_QUEUE_CONFIG, GALLERY_DL_MODE);
