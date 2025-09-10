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
import fs from 'node:fs';
import { serverLogger as logger } from '$lib/server/logger';
import { PATHS } from '$lib/server/constants';
import type { BatchUrlResult } from '$lib/stores/jobs.svelte';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validateAndBuildCliArgs } from '$lib/server/validation/option-validation';
import { executeGalleryDlCommand } from '$lib/server/jobs/commandExecutor';
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const requestData = await request.json();
    const { urls, args } = requestData ?? {};

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return createApiError('URLs are required and cannot be empty', 400);
    }

    // Filter out empty URLs
    const validUrls = urls
      .map((url: unknown) => (typeof url === 'string' ? url.trim() : ''))
      .filter((url: string) => url !== '');

    if (validUrls.length === 0) {
      return createApiError('At least one valid URL is required', 400);
    }

    // Parse args
    let receivedArgs: Array<[string, string | number | boolean]> = [];
    if (args && Array.isArray(args)) {
      receivedArgs = args;
    }

    // does gallery-dl binary exist
    try {
      fs.accessSync(PATHS.BIN_FILE, fs.constants.X_OK);
    } catch (_err) {
      logger.error('gallery-dl.bin not found or not executable');
      return createApiError('gallery-dl.bin not found or not executable', 500);
    }

    const batchResults: BatchUrlResult[] = [];
    let overallSuccess = true;

    for (const url of validUrls) {
      if (typeof url !== 'string' || !url.trim()) {
        batchResults.push({
          url: (url as string) || 'INVALID_URL_ENTRY',
          success: false,
          error: 'Invalid URL entry provided in the list.',
        });
        overallSuccess = false;
        continue;
      }

      const siteCliOptions = await siteConfigManager.getCliOptionsForUrl(url);

      const allArgs: Array<[string, string | number | boolean]> = [
        ...siteCliOptions,
        ...receivedArgs,
      ];

      const mergedArgs = new Map<string, string | number | boolean>();
      for (const [optionId, value] of allArgs) {
        mergedArgs.set(optionId, value);
      }

      const cliArgs = validateAndBuildCliArgs(mergedArgs);

      const result = await executeGalleryDlCommand(url, cliArgs);

      if (result.success && result.jobId) {
        batchResults.push({
          jobId: result.jobId,
          url,
          success: true,
          message: 'Job started successfully',
        });
      } else {
        batchResults.push({
          url,
          success: false,
          error: result.error || 'Failed to start job',
        });
        overallSuccess = false;
      }
    }

    const resp = createApiResponse({
      overallSuccess,
      results: batchResults,
    });
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    logger.error('Error in POST /api/command/start:', error);
    return handleApiError(error);
  }
};
