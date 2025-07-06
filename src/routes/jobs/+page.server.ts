/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { PageServerLoad } from './$types';
import { type Job, jobManager } from '$lib/server/jobManager';

export const load: PageServerLoad = async () => {
  try {
    const jobs: Job[] = await jobManager.getAllJobs();
    return {
      success: true,
      jobs,
    };
  } catch (_error) {
    // Use logger instead of console for consistency
    return {
      success: false,
      jobs: [],
      error: 'Failed to load jobs',
    };
  }
};
