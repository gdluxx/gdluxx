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
import { type Job, jobManager } from '$lib/server/jobs/jobManager';
import type { RequestHandler } from './$types';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { jobIdSchema } from '$lib/server/validation/command-validation';
import { requireUser } from '$lib/server/auth/requireUser';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { launchUrls, BinaryUnavailableError } from '$lib/server/jobs/commandLauncher';
import { ConfigExecutionBlockedError, ProhibitedOptionError } from '$lib/server/validation/exec-policy';

export const GET: RequestHandler = async ({ params, locals }: RequestEvent): Promise<Response> => {
  requireUser(locals);
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

export const POST: RequestHandler = async ({ params, locals }: RequestEvent): Promise<Response> => {
  requireUser(locals);
  try {
    const { jobId } = params;
    validateInput({ jobId }, jobIdSchema);
    const url = await jobManager.prepareJobRetry(jobId);
    if (!url) return handleApiError(new Error('Only failed jobs can be retried'));

    try {
      const siteOptions = await siteConfigManager.getCliOptionsForUrl(url);
      const results = await launchUrls({
        urls: [url], args: siteOptions, excludedOptions: [],
        resolveSiteOptions: async () => [], retryJobId: jobId,
      });
      const result = results[0];
      if (!result?.success) {
        await jobManager.completeJob(jobId, 1);
        return handleApiError(new Error(result?.error ?? 'Failed to retry job'));
      }
      return createApiResponse({ jobId, status: result.status ?? 'waiting' });
    } catch (error) {
      await jobManager.completeJob(jobId, 1);
      if (error instanceof BinaryUnavailableError) return handleApiError(error);
      if (error instanceof ProhibitedOptionError || error instanceof ConfigExecutionBlockedError) {
        return handleApiError(error);
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const DELETE: RequestHandler = async ({
  params,
  locals,
}: RequestEvent): Promise<Response> => {
  requireUser(locals);
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
