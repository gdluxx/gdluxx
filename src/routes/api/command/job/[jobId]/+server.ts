/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { type Job, jobManager } from '$lib/server/jobManager';
import type { RequestHandler } from './$types';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation-utils';
import { jobIdSchema } from '$lib/server/command-validation';

export const GET: RequestHandler = async ({ params }: RequestEvent): Promise<Response> => {
  try {
    const { jobId } = params;

    validateInput({ jobId }, jobIdSchema);

    if (!jobId) {
      return handleApiError(new Error('Job ID is required'));
    }

    const job: Job | undefined = await jobManager.getJob(jobId);
    if (!job) {
      return handleApiError(new Error('Job not found'));
    }

    const { process: _process, subscribers: _subscribers, ...jobData } = job;
    return createApiResponse({ job: jobData });
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const DELETE: RequestHandler = async ({ params }: RequestEvent): Promise<Response> => {
  try {
    const { jobId } = params;

    validateInput({ jobId }, jobIdSchema);

    if (!jobId) {
      return handleApiError(new Error('Job ID is required'));
    }

    const deleted: boolean = await jobManager.deleteJob(jobId);

    if (!deleted) {
      return handleApiError(new Error('Job not found'));
    }

    return createApiResponse({ message: 'Job deleted successfully' });
  } catch (error) {
    return handleApiError(error as Error);
  }
};