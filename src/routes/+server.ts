/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import { serverLogger as logger } from '$lib/server/logger';
import { PATHS } from '$lib/server/constants';
import type { BatchUrlResult } from '$lib/stores/jobs.svelte';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validateAndBuildCliArgs } from '$lib/server/validation/option-validation';
import { executeGalleryDlCommand } from '$lib/server/jobs/commandExecutor';

const getClientSafeMessage = (error: Error) => {
  if (dev) {
    return error.message;
  }

  if (error.name === 'ValidationError') {
    return 'Invalid input provided.';
  }
  if (error.name === 'NotFoundError') {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const requestData = await request.json();
    const { urls, args } = requestData;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return json(
        {
          overallSuccess: false,
          results: [],
          error: 'URLs are required and cannot be empty',
        },
        { status: 400 },
      );
    }

    // Filter out empty URLs
    const validUrls = urls
      .map((url: unknown) => (typeof url === 'string' ? url.trim() : ''))
      .filter((url: string) => url !== '');

    if (validUrls.length === 0) {
      return json(
        {
          overallSuccess: false,
          results: [],
          error: 'At least one valid URL is required',
        },
        { status: 400 },
      );
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
      return json(
        {
          overallSuccess: false,
          results: validUrls.map((url: string) => ({
            url,
            success: false,
            error: 'gallery-dl.bin not found or not executable',
          })),
          error: 'gallery-dl.bin not found or not executable',
        },
        { status: 500 },
      );
    }

    const batchResults: BatchUrlResult[] = [];
    let overallSuccess = true;

    for (const url of validUrls) {
      if (typeof url !== 'string' || !url.trim()) {
        batchResults.push({
          url: url || 'INVALID_URL_ENTRY',
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

    return json({
      overallSuccess,
      results: batchResults,
    });
  } catch (error) {
    logger.error('Error in POST endpoint:', error);
    return json(
      {
        overallSuccess: false,
        results: [],
        error: getClientSafeMessage(error as Error),
      },
      { status: 500 },
    );
  }
};
