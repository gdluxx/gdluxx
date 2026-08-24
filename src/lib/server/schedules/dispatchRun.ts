/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/* eslint-disable no-console */

import {
  BinaryUnavailableError,
  type LaunchResult,
  type LaunchRequest,
} from '$lib/server/jobs/commandLauncher';
import type { Schedule } from './scheduleManager';
import { addRunJob, finalizeRun, type RunOutcome } from './scheduleRunManager';
import { upsertCoalesced, type UpsertCoalescedInput } from './scheduleNotificationManager';

export const PROCESS_START_MS = Date.now();

export interface DispatchDeps {
  launch: (req: LaunchRequest) => Promise<LaunchResult[]>;
  getMaxBatchUrls: (userId: string) => number;
}

export interface DispatchOutcome {
  results: LaunchResult[];
  outcome: Extract<RunOutcome, 'launched' | 'partial' | 'launch_failed'>;
}

function notifyLaunchFailure(schedule: Schedule, runId: string): void {
  const notification: UpsertCoalescedInput = {
    userId: schedule.userId,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    runId,
    type: 'launch_failed',
    rangeStart: null,
    rangeEnd: null,
  };
  try {
    upsertCoalesced(notification);
  } catch (error) {
    // The owner may delete the schedule mid-dispatch; retry detached so the
    // notification survives with its denormalized name.
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      upsertCoalesced({ ...notification, scheduleId: null });
    } else {
      throw error;
    }
  }
}

// Never throws: callers (coordinator tick, /run route) rely on a terminal
// outcome being recorded for every claimed run.
export async function dispatchRun(
  schedule: Schedule,
  runId: string,
  deps: DispatchDeps,
): Promise<DispatchOutcome> {
  const { urls, userOptions, excludedOptions } = schedule.commandSource;
  const linked: LaunchResult[] = [];

  try {
    const maxBatchUrls = deps.getMaxBatchUrls(schedule.userId);
    if (urls.length > maxBatchUrls) {
      const error = `Schedule has ${urls.length} URLs but the owner's batch limit is ${maxBatchUrls}`;
      finalizeRun(runId, { outcome: 'launch_failed', launchedCount: 0, error });
      notifyLaunchFailure(schedule, runId);
      return {
        results: urls.map((url) => ({ url, success: false, error })),
        outcome: 'launch_failed',
      };
    }

    const results = await deps.launch({
      urls,
      args: userOptions,
      excludedOptions,
      resolveSiteOptions: async (url) => schedule.siteOptionsSnapshot[url] ?? [],
      onLaunched: (result) => {
        if (result.success && result.jobId) {
          // A failed link must not abort the remaining URLs or drop this job
          // from the launched count — the job itself is already running.
          try {
            addRunJob(runId, result.jobId, result.url);
          } catch (error) {
            console.error(`Failed to link job ${result.jobId} to run ${runId}:`, error);
          }
          linked.push(result);
        }
      },
    });

    const launchedCount = results.filter((result) => result.success).length;
    const outcome: DispatchOutcome['outcome'] =
      launchedCount === results.length
        ? 'launched'
        : launchedCount > 0
          ? 'partial'
          : 'launch_failed';
    const firstError = results.find((result) => !result.success)?.error ?? null;

    finalizeRun(runId, { outcome, launchedCount, error: firstError });
    if (outcome !== 'launched') {
      notifyLaunchFailure(schedule, runId);
    }
    return { results, outcome };
  } catch (error) {
    const message =
      error instanceof BinaryUnavailableError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to dispatch scheduled run';
    console.error(`Failed to dispatch run ${runId} for schedule ${schedule.id}:`, error);
    const outcome: DispatchOutcome['outcome'] = linked.length > 0 ? 'partial' : 'launch_failed';
    try {
      finalizeRun(runId, { outcome, launchedCount: linked.length, error: message });
      notifyLaunchFailure(schedule, runId);
    } catch (finalizeError) {
      console.error(`Failed to record launch failure for run ${runId}:`, finalizeError);
    }
    const launchedUrls = new Set(linked.map((result) => result.url));
    return {
      results: [
        ...linked,
        ...urls
          .filter((url) => !launchedUrls.has(url))
          .map((url) => ({ url, success: false, error: message })),
      ],
      outcome,
    };
  }
}
