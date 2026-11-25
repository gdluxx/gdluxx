/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestHandler } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { requireUser } from '$lib/server/auth/requireUser';
import { API_LIMITS } from '$lib/server/constants';
import { jobManager, RetryJobError } from '$lib/server/jobs/jobManager';
import { retryPreconditionError } from '$lib/server/jobs/retryPreconditions';
import type { JobStatus } from '$lib/types/jobs';

interface RetryResult {
  retryOfJobId: string;
  success: boolean;
  jobId?: string;
  status?: JobStatus;
  error?: string;
}

export const POST: RequestHandler = async ({ locals }): Promise<Response> => {
  requireUser(locals);

  try {
    const preconditionError = await retryPreconditionError();
    if (preconditionError) {
      return preconditionError;
    }

    const failedJobIds = await jobManager.getRetryableFailedJobIds(
      API_LIMITS.MAX_RETRY_FAILED_JOBS,
    );
    const results: RetryResult[] = [];

    for (const retryOfJobId of failedJobIds) {
      try {
        const { jobId, status } = await jobManager.retryJob(retryOfJobId);
        results.push({ retryOfJobId, success: true, jobId, status });
      } catch (error) {
        if (!(error instanceof RetryJobError)) {
          logger.error(`Error retrying job ${retryOfJobId}:`, error);
        }
        const message = error instanceof RetryJobError ? error.message : 'Failed to retry job.';
        results.push({ retryOfJobId, success: false, error: message });
      }
    }

    const accepted = results.filter((result) => result.success).length;
    return createApiResponse({
      total: failedJobIds.length,
      accepted,
      failed: results.length - accepted,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
