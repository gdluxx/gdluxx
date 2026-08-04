/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { validateApiKey } from '$lib/server/auth/apiAuth';
import { readJobsByIds } from '$lib/server/jobs/jobsManager';
import { extensionJobsQuerySchema } from '$lib/server/validation/jobs-validation';

interface AuthContext {
  apiKeyId: string;
  apiKeyName: string | null;
}

async function authenticate(request: Request): Promise<AuthContext | { errorResponse: Response }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: createApiError('Authorization header with Bearer token is required', 401),
    };
  }

  const plainApiKey = authHeader.substring(7).trim();
  if (!plainApiKey) {
    return { errorResponse: createApiError('Bearer token cannot be empty', 400) };
  }

  const authResult = await validateApiKey(plainApiKey);
  if (!authResult.success || !authResult.keyInfo) {
    logger.warn(`Extension jobs auth failure: ${authResult.error ?? 'Invalid API key.'}`);
    return { errorResponse: createApiError(authResult.error ?? 'Invalid API key.', 401) };
  }

  return { apiKeyId: authResult.keyInfo.id, apiKeyName: authResult.keyInfo.name || null };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const parsed = extensionJobsQuerySchema.safeParse({ ids: url.searchParams.get('ids') ?? '' });
  if (!parsed.success) {
    return createApiError('Invalid or missing ids parameter (comma-separated, max 100).', 400);
  }

  const jobs = readJobsByIds(parsed.data.ids);

  const response = createApiResponse({ jobs });
  response.headers.set('Cache-Control', 'no-store');
  return response;
};
