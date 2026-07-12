/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export type JobStatus = 'running' | 'success' | 'no_action' | 'error';

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
}

export interface JobsSummary {
  counts: {
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
  runningJobIds: string[];
  recent: JobListItem[];
}
