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
import { createApiResponse, createApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { externalApiSchema } from '$lib/server/validation/command-validation';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validateAndBuildCliArgs } from '$lib/server/validation/option-validation';
import {
  executeGalleryDlCommand,
  executeGalleryDlBatchCommand,
} from '$lib/server/jobs/commandExecutor';
import { userSettingsManager } from '$lib/server/userSettingsManager';

interface ExternalApiRequestBody {
  urlToProcess?: unknown;
  urls?: unknown;
  customDirectory?: unknown;
  siteDirectory?: unknown;
}

function buildDirectoryArgs(siteDir?: string, customDir?: string): string[] {
  const parts: string[] = [];
  if (siteDir) {
    parts.push(`"${siteDir.replace(/"/g, '\\"')}"`);
  }
  if (customDir) {
    parts.push(`"${customDir.replace(/"/g, '\\"')}"`);
  }
  if (parts.length === 0) {
    return [];
  }
  return ['-o', `directory=[${parts.join(',')}]`];
}

function isDirectMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|mp4|webm|mov|avi|mkv|flv|wmv)$/i.test(path);
  } catch {
    return false;
  }
}

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  // Extract bearer token from auth header
  const authHeader: string | null = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return createApiError('Authorization header with Bearer token is required', 400);
  }

  const plainApiKey = authHeader.substring(7);
  if (!plainApiKey || plainApiKey.trim() === '') {
    return createApiError('Bearer token cannot be empty', 400);
  }

  // Authenticate before parsing the body
  const authResult: AuthResult = await validateApiKey(plainApiKey);
  if (!authResult.success) {
    logger.warn(`Invalid API key attempt via extension endpoint. Error: ${authResult.error}`);
    return createApiError(authResult.error || 'Invalid API key.', 401);
  }

  const userId = authResult.keyInfo?.userId ?? '';
  const userSettings = userSettingsManager.getUserSettings(userId);
  const maxUrls = userSettings.maxBatchUrls;

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
    validateInput(
      {
        urlToProcess: body.urlToProcess,
        urls: body.urls,
        customDirectory: body.customDirectory,
        siteDirectory: body.siteDirectory,
      },
      externalApiSchema,
    );
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
  if (urls.length > maxUrls) {
    return createApiError(`Too many URLs. Max allowed is ${maxUrls}.`, 400);
  }

  // Extracting custom directory
  const customDirectory =
    typeof body.customDirectory === 'string' && body.customDirectory.trim()
      ? body.customDirectory.trim()
      : undefined;

  // Extracting site for directory name
  const siteDirectory =
    typeof body.siteDirectory === 'string' && body.siteDirectory.trim()
      ? body.siteDirectory.trim()
      : undefined;

  logger.info(
    `API key validated for: ${authResult.keyInfo?.name} (ID: ${authResult.keyInfo?.id}). Processing ${urls.length} URL(s)${customDirectory ? ` with custom directory: ${customDirectory}` : ''}`,
  );
  // directlinks will be batched while standard URLs will be processed individually
  const directMediaUrls = urls.filter((url) => isDirectMediaUrl(url));
  const galleryUrls = urls.filter((url) => !isDirectMediaUrl(url));

  // Should we create a batch?
  // Only create batch job if
  // - There are 2+ direct media URLs, OR
  // - There is 1 direct media URL AND at least 1 gallery URL
  const shouldBatchDirectMedia =
    directMediaUrls.length >= 2 || (directMediaUrls.length === 1 && galleryUrls.length > 0);

  logger.info(
    `Processing ${urls.length} URL(s): ${directMediaUrls.length} direct media, ${galleryUrls.length} gallery URLs${customDirectory ? ` with custom directory: ${customDirectory}` : ''}`,
  );

  const results: BatchUrlResult[] = [];
  let overallSuccess = true;

  // Process direct media as batch job or individual job
  if (directMediaUrls.length > 0 && shouldBatchDirectMedia) {
    try {
      const cliArgs = [];

      cliArgs.push(...buildDirectoryArgs(siteDirectory, customDirectory));

      logger.info(`Creating batch job for ${directMediaUrls.length} direct media URL(s)`);
      const result = await executeGalleryDlBatchCommand(directMediaUrls, cliArgs);

      if (result.success && result.jobId) {
        results.push({
          jobId: result.jobId,
          url: 'directlink batch',
          success: true,
          message: `Batch job started successfully for ${directMediaUrls.length} item(s)`,
        });
      } else {
        results.push({
          url: 'directlink batch',
          success: false,
          error: result.error || 'Failed to start batch job',
        });
        overallSuccess = false;
      }
    } catch (error) {
      logger.error('Error processing direct media batch:', error);
      results.push({
        url: 'directlink batch',
        success: false,
        error: 'Unexpected error starting batch job',
      });
      overallSuccess = false;
    }
  } else if (directMediaUrls.length === 1 && galleryUrls.length === 0) {
    // Single directlink URL submitted alone will process as an individual job
    const url = directMediaUrls[0];
    try {
      const cliArgs = [];

      cliArgs.push(...buildDirectoryArgs(siteDirectory, customDirectory));

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

  // Process gallery URLs individually
  for (const url of galleryUrls) {
    try {
      // Get site-rules
      const siteCliOptions = await siteConfigManager.getCliOptionsForUrl(url);
      const optionsMap = new Map(siteCliOptions);

      // Build CLI argument
      const cliArgs = validateAndBuildCliArgs(optionsMap);

      cliArgs.push(...buildDirectoryArgs(siteDirectory, customDirectory));

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
