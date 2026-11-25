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
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import { requireUser } from '$lib/server/auth/requireUser';
import { jobIdParamsSchema } from '$lib/server/validation/jobs-validation';
import { jobManager, RetryJobError } from '$lib/server/jobs/jobManager';
import { retryPreconditionError } from '$lib/server/jobs/retryPreconditions';

export const POST: RequestHandler = async ({ params, locals }): Promise<Response> => {
  requireUser(locals);

  const parsed = jobIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    return createApiError('Invalid job ID.', 400);
  }
  const retryOfJobId = parsed.data.jobId;

  try {
    const preconditionError = await retryPreconditionError();
    if (preconditionError) {
      return preconditionError;
    }

    const { jobId, status } = await jobManager.retryJob(retryOfJobId);
    return createApiResponse({ jobId, retryOfJobId, status });
  } catch (error) {
    if (error instanceof RetryJobError) {
      return createApiError(error.message, error.statusCode);
    }
    logger.error(`Error retrying job ${retryOfJobId}:`, error);
    return handleApiError(error);
  }
};
