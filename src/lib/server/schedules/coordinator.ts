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

import { withImmediateTransaction } from '$lib/server/dbTransaction';
import type { launchUrls } from '$lib/server/jobs/commandLauncher';
import { computeNextOccurrence, listMissedOccurrences, type RecurrenceInput } from './recurrence';
import {
  claimAdvance,
  readDueSchedules,
  type MisfirePolicy,
  type Schedule,
} from './scheduleManager';
import {
  countLinkedJobsForRun,
  createRun,
  finalizeRun,
  hasBlockingActivityForSchedule,
  readStaleDispatchingRuns,
  type RunTrigger,
} from './scheduleRunManager';
import { upsertCoalesced, type NotificationType } from './scheduleNotificationManager';
import { dispatchRun, PROCESS_START_MS } from './dispatchRun';

export const SCAN_INTERVAL_MS = 30_000;
// Invariant: MIN_INTERVAL_MINUTES * 60_000 > MISFIRE_GRACE_MS. The classifier
// treats at most the last due slot as on-time; a shorter minimum interval would
// let two genuinely-on-time slots share one scan window.
export const MISFIRE_GRACE_MS = 150_000;
export const MAX_MISSED_PER_SCAN = 1000;

export interface SchedulerDeps {
  now: () => number;
  whenReady: () => Promise<void>;
  launch: typeof launchUrls;
  getMaxBatchUrls: (userId: string) => number;
  processStartMs?: number;
}

export interface Scheduler {
  start(): Promise<void>;
  stop(): void;
  runScanOnce(): Promise<void>;
}

class ClaimAbortedError extends Error {}

interface MisfireWindow {
  from: number;
  to: number;
  count: number;
  truncated: boolean;
}

interface DispatchPlan {
  trigger: RunTrigger;
  scheduledFor: number;
  window: MisfireWindow | null;
}

interface ScanPlan {
  claimedSlot: number;
  dispatch: DispatchPlan | null;
  misfire: { scheduledFor: number; window: MisfireWindow } | null;
  caughtUp: MisfireWindow | null;
}

function recurrenceInputOf(schedule: Schedule): RecurrenceInput {
  return {
    recurrence: schedule.recurrence,
    timezone: schedule.timezone,
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? undefined,
  };
}

function windowOver(slots: number[]): MisfireWindow {
  return {
    from: slots[0],
    to: slots[slots.length - 1],
    count: slots.length,
    truncated: false,
  };
}

function missedWindowPlan(policy: MisfirePolicy, slot: number, window: MisfireWindow): ScanPlan {
  if (policy === 'skip') {
    return {
      claimedSlot: slot,
      dispatch: null,
      misfire: { scheduledFor: slot, window },
      caughtUp: null,
    };
  }
  return {
    claimedSlot: slot,
    dispatch: { trigger: 'catch_up', scheduledFor: slot, window },
    misfire: null,
    caughtUp: window,
  };
}

function classify(schedule: Schedule, dueAt: number, now: number): ScanPlan {
  const { occurrences: slots, truncated } = listMissedOccurrences(
    recurrenceInputOf(schedule),
    dueAt - 1,
    now,
    MAX_MISSED_PER_SCAN,
  );

  if (slots.length === 0) {
    // The recurrence no longer yields the due slot (corrupt or edited row):
    // advance anyway so the schedule completes instead of being re-read every
    // scan forever.
    return { claimedSlot: dueAt, dispatch: null, misfire: null, caughtUp: null };
  }

  const current = slots[slots.length - 1];

  if (truncated) {
    return missedWindowPlan(schedule.misfirePolicy, current, {
      from: slots[0],
      to: now,
      count: MAX_MISSED_PER_SCAN,
      truncated: true,
    });
  }

  const stale = slots.slice(0, -1);
  const currentOnTime = now - current <= MISFIRE_GRACE_MS;

  if (!currentOnTime) {
    return missedWindowPlan(schedule.misfirePolicy, current, windowOver(slots));
  }

  if (stale.length === 0) {
    return {
      claimedSlot: current,
      dispatch: { trigger: 'scheduled', scheduledFor: current, window: null },
      misfire: null,
      caughtUp: null,
    };
  }

  const window = windowOver(stale);
  if (schedule.misfirePolicy === 'skip') {
    return {
      claimedSlot: current,
      dispatch: { trigger: 'scheduled', scheduledFor: current, window: null },
      misfire: { scheduledFor: window.to, window },
      caughtUp: null,
    };
  }
  return {
    claimedSlot: current,
    dispatch: { trigger: 'scheduled', scheduledFor: current, window },
    misfire: null,
    caughtUp: window,
  };
}

function notify(
  schedule: Schedule,
  runId: string,
  type: NotificationType,
  rangeStart: number,
  rangeEnd: number,
): void {
  upsertCoalesced({
    userId: schedule.userId,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    runId,
    type,
    rangeStart,
    rangeEnd,
  });
}

function claim(
  schedule: Schedule,
  dueAt: number,
  plan: ScanPlan,
  now: number,
  processStartMs: number,
): string | null {
  const urlCount = schedule.commandSource.urls.length;

  return withImmediateTransaction(() => {
    const nextOccurrenceAt = computeNextOccurrence(recurrenceInputOf(schedule), now);
    const changes = claimAdvance(schedule.id, dueAt, {
      nextOccurrenceAt,
      lastOccurrenceAt: plan.claimedSlot,
      status: nextOccurrenceAt === null ? 'completed' : 'active',
    });
    if (changes === 0) {
      throw new ClaimAbortedError();
    }

    if (plan.misfire) {
      const missedRun = createRun({
        scheduleId: schedule.id,
        userId: schedule.userId,
        scheduleName: schedule.name,
        trigger: 'scheduled',
        outcome: 'skipped_misfire',
        scheduledFor: plan.misfire.scheduledFor,
        urlCount,
        missedFrom: plan.misfire.window.from,
        missedTo: plan.misfire.window.to,
        missedCount: plan.misfire.window.count,
        truncated: plan.misfire.window.truncated,
      });
      notify(
        schedule,
        missedRun.id,
        'missed_skipped',
        plan.misfire.window.from,
        plan.misfire.window.to,
      );
    }

    if (!plan.dispatch) {
      return null;
    }

    const blocked = hasBlockingActivityForSchedule(schedule.id, processStartMs);
    const window = plan.dispatch.window;
    const run = createRun({
      scheduleId: schedule.id,
      userId: schedule.userId,
      scheduleName: schedule.name,
      trigger: plan.dispatch.trigger,
      outcome: blocked ? 'skipped_overlap' : 'dispatching',
      scheduledFor: plan.dispatch.scheduledFor,
      urlCount,
      missedFrom: window?.from ?? null,
      missedTo: window?.to ?? null,
      missedCount: window?.count ?? null,
      truncated: window?.truncated ?? false,
    });

    if (plan.caughtUp) {
      notify(schedule, run.id, 'missed_caught_up', plan.caughtUp.from, plan.caughtUp.to);
    }
    if (blocked) {
      notify(
        schedule,
        run.id,
        'overlap_skipped',
        plan.dispatch.scheduledFor,
        plan.dispatch.scheduledFor,
      );
      return null;
    }

    return run.id;
  });
}

function reconcileStaleClaims(processStartMs: number): void {
  for (const run of readStaleDispatchingRuns(processStartMs)) {
    try {
      const linkedCount = countLinkedJobsForRun(run.id);
      if (linkedCount > 0) {
        finalizeRun(run.id, { outcome: 'partial', launchedCount: linkedCount });
        continue;
      }
      const error = 'Dispatch was interrupted before any job started';
      finalizeRun(run.id, { outcome: 'launch_failed', launchedCount: 0, error });
      upsertCoalesced({
        userId: run.userId,
        scheduleId: run.scheduleId,
        scheduleName: run.scheduleName,
        runId: run.id,
        type: 'launch_failed',
        rangeStart: null,
        rangeEnd: null,
      });
    } catch (error) {
      console.error(`Failed to reconcile stale schedule run ${run.id}:`, error);
    }
  }
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const processStartMs = deps.processStartMs ?? PROCESS_START_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function processSchedule(schedule: Schedule, now: number): Promise<void> {
    const dueAt = schedule.nextOccurrenceAt;
    if (dueAt === null) {
      return;
    }
    const runId = claim(schedule, dueAt, classify(schedule, dueAt, now), now, processStartMs);
    if (runId === null) {
      return;
    }
    await dispatchRun(schedule, runId, {
      launch: deps.launch,
      getMaxBatchUrls: deps.getMaxBatchUrls,
    });
  }

  // Never throws: the timer re-arms off this promise, and a rejected scan would
  // stop the scheduler for the life of the process.
  async function runScanOnce(): Promise<void> {
    try {
      const now = deps.now();
      for (const schedule of readDueSchedules(now)) {
        try {
          await processSchedule(schedule, now);
        } catch (error) {
          if (!(error instanceof ClaimAbortedError)) {
            console.error(`Failed to process schedule ${schedule.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Schedule scan failed:', error);
    }
  }

  function armNextScan(): void {
    if (stopped) {
      return;
    }
    // Re-armed only once the scan has settled, so an overrun delays the next
    // tick instead of running two scans concurrently.
    timer = setTimeout(() => {
      void runScanOnce().finally(armNextScan);
    }, SCAN_INTERVAL_MS);
    timer.unref();
  }

  async function start(): Promise<void> {
    await deps.whenReady();
    reconcileStaleClaims(processStartMs);
    await runScanOnce();
    armNextScan();
  }

  function stop(): void {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { start, stop, runScanOnce };
}
