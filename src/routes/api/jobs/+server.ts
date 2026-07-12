/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { jobManager } from '$lib/server/jobs/jobManager';
import type { RequestHandler } from './$types';
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import { parseJson } from '$lib/server/validation/zod';
import { jobsDeleteSchema, jobsQuerySchema } from '$lib/server/validation/jobs-validation';

const QUERY_KEYS = ['limit', 'offset', 'status', 'sort', 'dir'] as const;

export const GET: RequestHandler = async ({ url }): Promise<Response> => {
  try {
    const raw: Record<string, string> = {};
    for (const key of QUERY_KEYS) {
      const value = url.searchParams.get(key);
      if (value !== null) {
        raw[key] = value;
      }
    }

    const parsed = jobsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid query parameters.';
      return createApiError(message, 400);
    }

    const { limit, offset, status, sort, dir } = parsed.data;
    const { jobs, total } = await jobManager.getJobsList({
      limit,
      offset,
      statuses: status,
      sort,
      dir,
    });

    const resp = createApiResponse({ jobs, total, limit, offset });
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const DELETE: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const parseResult = await parseJson(request, jobsDeleteSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }

    const { ids, all } = parseResult.data;
    const deletedCount = all
      ? await jobManager.deleteAllJobs()
      : await jobManager.deleteJobs(ids ?? []);

    return createApiResponse({ deletedCount });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
