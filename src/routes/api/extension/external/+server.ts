/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { serverLogger as logger } from '$lib/server/logger';
import { type AuthResult, validateApiKey } from '$lib/server/auth/apiAuth';
import type { BatchJobStartResult, BatchUrlResult } from '$lib/stores/jobs.svelte';
import { createApiResponse, createApiError, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { externalApiSchema } from '$lib/server/validation/command-validation';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validateAndBuildCliArgs } from '$lib/server/validation/option-validation';
import { executeGalleryDlCommand } from '$lib/server/jobs/commandExecutor';
import { API_LIMITS } from '$lib/server/constants';

interface ExternalApiRequestBody {
  urlToProcess?: unknown;
  urls?: unknown;
}

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  // Extract bearer token from auth header
  const authHeader: string | null = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return handleApiError(new Error('Authorization header with Bearer token is required'));
  }

  const plainApiKey = authHeader.substring(7);
  if (!plainApiKey || plainApiKey.trim() === '') {
    return handleApiError(new Error('Bearer token cannot be empty'));
  }

  let body: ExternalApiRequestBody;

  try {
    body = await request.json();
  } catch (jsonParseError) {
    logger.warn(
      'Failed to parse request body as JSON for /api/extension/external:',
      jsonParseError,
    );
    return createApiError('Invalid request body. Expected valid JSON.', 400);
  }

  if (typeof body !== 'object' || body === null) {
    logger.warn('Request body is not a valid JSON object for /api/extension/external:', body);
    return createApiError('Invalid request body. Expected a JSON object.', 400);
  }

  try {
    validateInput({ urlToProcess: body.urlToProcess, urls: body.urls }, externalApiSchema);
  } catch (error) {
    logger.warn('Validation error for external API:', error);
    return createApiError('Invalid input provided.', 400);
  }

  // Normalizing to an array
  const rawUrls: unknown[] = Array.isArray(body.urls)
    ? body.urls
    : body.urlToProcess
      ? [body.urlToProcess]
      : [];

  const urls = rawUrls
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u.length > 0);

  if (urls.length === 0) {
    return createApiError('At least one URL is required', 400);
  }
  if (urls.length > API_LIMITS.MAX_BATCH_URLS) {
    return createApiError(`Too many URLs. Max allowed is ${API_LIMITS.MAX_BATCH_URLS}.`, 400);
  }

  const authResult: AuthResult = await validateApiKey(plainApiKey);

  if (!authResult.success) {
    logger.warn(`Invalid API key attempt via extension endpoint. Error: ${authResult.error}`);
    return handleApiError(new Error(authResult.error || 'Invalid API key.'));
  }

  logger.info(
    `API key validated for: ${authResult.keyInfo?.name} (ID: ${authResult.keyInfo?.id}). Processing ${urls.length} URL(s)`,
  );

  // Process each URL
  const results: BatchUrlResult[] = [];
  let overallSuccess = true;

  for (const url of urls) {
    try {
      // Get site-rules
      const siteCliOptions = await siteConfigManager.getCliOptionsForUrl(url);
      const optionsMap = new Map(siteCliOptions);

      // Build CLI argument
      const cliArgs = validateAndBuildCliArgs(optionsMap);
      const result = await executeGalleryDlCommand(url, cliArgs);

      if (result.success && result.jobId) {
        results.push({
          jobId: result.jobId,
          url,
          success: true,
          message: 'Job started successfully',
        });
      } else {
        results.push({
          url,
          success: false,
          error: result.error || 'Failed to start job',
        });
        overallSuccess = false;
      }
    } catch (error) {
      logger.error(`Error processing URL ${url}:`, error);
      results.push({
        url,
        success: false,
        error: 'Unexpected error starting job',
      });
      overallSuccess = false;
    }
  }

  const batchResult: BatchJobStartResult = {
    overallSuccess,
    results,
  };

  return createApiResponse(batchResult);
};
