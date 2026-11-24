/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export type JobStatus = 'waiting' | 'running' | 'success' | 'no_action' | 'error';

export interface JobScheduleOrigin {
  scheduleId: string | null;
  scheduleName: string;
}

export interface JobListItem {
  id: string;
  url: string;
  status: JobStatus;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  batchCount?: number;
  retryOfJobId?: string;
  retriedByJobId?: string;
  retryable: boolean;
  origin?: JobScheduleOrigin;
}

export interface JobsSummary {
  counts: {
    waiting: number;
    running: number;
    success: number;
    no_action: number;
    error: number;
    total: number;
  };
  totals: {
    downloads: number;
    skips: number;
  };
  retryableFailedCount: number;
  runningJobIds: string[];
  recent: JobListItem[];
}

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['waiting', 'running'];

export function isActiveJobStatus(status: JobStatus): boolean {
  return ACTIVE_JOB_STATUSES.includes(status);
}
