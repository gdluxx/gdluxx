/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Type-only import: erased at compile time, so no server code (or the Temporal
// polyfill) reaches a client bundle.
import type { Recurrence } from '$lib/server/schedules/recurrence';

export type { Recurrence };

export type ScheduleStatus = 'active' | 'paused' | 'completed';
export type MisfirePolicy = 'skip' | 'catch_up';
export type ScheduleRunTrigger = 'scheduled' | 'catch_up' | 'manual' | 'recovery';
export type ScheduleRunOutcome =
  | 'dispatching'
  | 'launched'
  | 'partial'
  | 'launch_failed'
  | 'skipped_overlap'
  | 'skipped_misfire';
export type ScheduleNotificationType =
  | 'missed_skipped'
  | 'missed_caught_up'
  | 'overlap_skipped'
  | 'launch_failed';

export type MaskedOptionValue = string | number | boolean | { sensitive: true; hasValue: true };
export type MaskedOptionPair = [string, MaskedOptionValue];

export interface ScheduleSummary {
  id: string;
  name: string;
  status: ScheduleStatus;
  recurrenceSummary: string;
  timezone: string;
  nextOccurrenceAt: number | null;
  lastOccurrenceAt: number | null;
  latestRun: { outcome: ScheduleRunOutcome; createdAt: number } | null;
}

export interface ScheduleDetail {
  id: string;
  name: string;
  status: ScheduleStatus;
  timezone: string;
  recurrence: Recurrence;
  startDate: string;
  endDate: string | null;
  misfirePolicy: MisfirePolicy;
  commandSource: {
    urls: string[];
    userOptions: MaskedOptionPair[];
    excludedOptions: string[];
  };
  siteOptionsSnapshot: Record<string, MaskedOptionPair[]>;
  nextOccurrenceAt: number | null;
  lastOccurrenceAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleRunItem {
  id: string;
  scheduleId: string | null;
  scheduleName: string;
  trigger: ScheduleRunTrigger;
  outcome: ScheduleRunOutcome;
  scheduledFor: number;
  urlCount: number;
  launchedCount: number;
  missedFrom: number | null;
  missedTo: number | null;
  missedCount: number | null;
  truncated: boolean;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  jobIds: string[];
}

export interface ScheduleNotificationItem {
  id: string;
  scheduleId: string | null;
  scheduleName: string;
  runId: string | null;
  type: ScheduleNotificationType;
  occurrenceCount: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  acknowledgedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleRunResponse {
  overallSuccess: boolean;
  results: Array<{ url: string; success: boolean; jobId?: string; error?: string }>;
  runId: string;
}

export interface SchedulePreviewResponse {
  occurrences: number[];
  recurrenceSummary: string;
}
