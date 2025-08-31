/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ClientJob, BatchJobStartResult } from '$lib/stores/jobs.svelte';
import type { Job } from '$lib/server/jobs/jobManager';

export interface JobStoreState {
  jobs: Map<string, ClientJob>;
  isJobListModalOpen: boolean;
}

export interface JobStoreMethods {
  startJob: (
    urls: string[],
    options?: Map<string, string | number | boolean>,
  ) => Promise<BatchJobStartResult>;
  deleteJob: (jobId: string) => Promise<void>;
  showJob: (jobId: string) => void;
  hideJob: (jobId: string) => void;
  toggleJobVisibility: (jobId: string) => void;
  loadJobs: () => Promise<void>;
  reconnectToRunningJobs: () => void;
  initializeWithJobs: (serverJobs: Job[]) => void;
  showJobListModal: () => void;
  hideJobListModal: () => void;
  toggleJobListModal: () => void;
}

export interface JobStoreAPI extends JobStoreMethods {
  readonly jobs: Map<string, ClientJob>;
  readonly isJobListModalOpen: boolean;
}
