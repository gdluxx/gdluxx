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
import type { BatchJobStartResult } from '$lib/stores/jobs.svelte';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { externalApiSchema } from '$lib/server/validation/command-validation';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validateAndBuildCliArgs } from '$lib/server/validation/option-validation';
import { executeGalleryDlCommand } from '$lib/server/jobs/commandExecutor';

interface ExternalApiRequestBody {
  urlToProcess: unknown;
}

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  let body: ExternalApiRequestBody;

  // Extract bearer token from auth header
  const authHeader: string | null = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return handleApiError(new Error('Authorization header with Bearer token is required'));
  }

  const plainApiKey = authHeader.substring(7);
  if (!plainApiKey || plainApiKey.trim() === '') {
    return handleApiError(new Error('Bearer token cannot be empty'));
  }

  try {
    try {
      body = await request.json();
    } catch (jsonParseError) {
      logger.warn(
        'Failed to parse request body as JSON for /api/extension/external:',
        jsonParseError,
      );
      return handleApiError(new Error('Invalid request body. Expected valid JSON.'));
    }

    if (typeof body !== 'object' || body === null) {
      logger.warn('Request body is not a valid JSON object for /api/extension/external:', body);
      return handleApiError(new Error('Invalid request body. Expected a JSON object.'));
    }

    // Validate input
    try {
      validateInput(
        {
          urlToProcess: body.urlToProcess,
        },
        externalApiSchema,
      );
    } catch (error) {
      return handleApiError(error as Error);
    }
  } catch (error) {
    logger.warn('Unexpected error processing external endpoint request:', error);
    return handleApiError(error as Error);
  }

  const urlToProcess = body.urlToProcess as string;

  const authResult: AuthResult = await validateApiKey(plainApiKey);

  if (!authResult.success) {
    logger.warn(`Invalid API key attempt via extension endpoint. Error: ${authResult.error}`);
    return handleApiError(new Error(authResult.error || 'Invalid API key.'));
  }

  logger.info(
    `API key validated for: ${authResult.keyInfo?.name} (ID: ${authResult.keyInfo?.id}). Forwarding URL: ${urlToProcess}`,
  );

  try {
    // Get site-specific CLI options
    const siteCliOptions = await siteConfigManager.getCliOptionsForUrl(urlToProcess);
    const optionsMap = new Map(siteCliOptions);

    // Build CLI arguments from site options
    const cliArgs = validateAndBuildCliArgs(optionsMap);

    // Execute command using shared utility
    const result = await executeGalleryDlCommand(urlToProcess, cliArgs);

    if (result.success && result.jobId) {
      const batchResult: BatchJobStartResult = {
        overallSuccess: true,
        results: [
          {
            jobId: result.jobId,
            url: urlToProcess,
            success: true,
            message: 'Job started successfully',
          },
        ],
      };

      return createApiResponse(batchResult);
    } else {
      return handleApiError(new Error(result.error || 'Failed to start job'));
    }
  } catch (error) {
    logger.error('Error creating job:', error);
    return handleApiError(new Error('Failed to create job.'));
  }
};
