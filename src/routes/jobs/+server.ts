/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { type Job, jobManager } from '$lib/server/jobs/jobManager';
import type { RequestHandler } from './$types';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const jobs: Job[] = await jobManager.getAllJobs();
    return createApiResponse({ jobs });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
