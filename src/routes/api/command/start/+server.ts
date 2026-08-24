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
import type { BatchUrlResult } from '$lib/stores/jobs.svelte';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import {
  launchUrls,
  BinaryUnavailableError,
  type LaunchResult,
} from '$lib/server/jobs/commandLauncher';
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import { requireUser } from '$lib/server/auth/requireUser';
import {
  ConfigExecutionBlockedError,
  ProhibitedOptionError,
} from '$lib/server/validation/exec-policy';

const URL_PATTERN = /^https?:\/\/.+/;

export const POST: RequestHandler = async ({ request, locals }) => {
  requireUser(locals);
  try {
    const requestData = await request.json();
    const { urls, args, excludedOptions } = requestData ?? {};

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return createApiError('URLs are required and cannot be empty', 400);
    }

    const validUrls = urls
      .map((url: unknown) => (typeof url === 'string' ? url.trim() : ''))
      .filter((url: string) => url !== '');

    if (validUrls.length === 0) {
      return createApiError('At least one valid URL is required', 400);
    }

    if (!validUrls.every((url: string) => URL_PATTERN.test(url))) {
      return createApiError('All URLs must start with http:// or https://', 400);
    }

    let receivedArgs: Array<[string, string | number | boolean]> = [];
    if (args && Array.isArray(args)) {
      receivedArgs = args;
    }

    let excludedOptionIds: string[] = [];
    if (excludedOptions && Array.isArray(excludedOptions)) {
      excludedOptionIds = excludedOptions.filter(
        (x: unknown): x is string => typeof x === 'string',
      );
    }

    let launchResults: LaunchResult[];
    try {
      launchResults = await launchUrls({
        urls: validUrls,
        args: receivedArgs,
        excludedOptions: excludedOptionIds,
        resolveSiteOptions: (url) => siteConfigManager.getCliOptionsForUrl(url),
      });
    } catch (error) {
      if (error instanceof BinaryUnavailableError) {
        logger.error('gallery-dl.bin not found or not executable');
        return createApiError('gallery-dl.bin not found or not executable', 500);
      }
      if (error instanceof ProhibitedOptionError) {
        logger.warn(`Rejected prohibited option ids: ${error.optionIds.join(', ')}`);
        return createApiError(error.clientMessage, 400);
      }
      if (error instanceof ConfigExecutionBlockedError) {
        logger.error('Blocked job launch on stored config:', error.violations);
        return createApiError(error.clientMessage, 409);
      }
      throw error;
    }

    const batchResults: BatchUrlResult[] = launchResults.map((result) =>
      result.success && result.jobId
        ? {
            jobId: result.jobId,
            url: result.url,
            success: true,
            message: 'Job started successfully',
          }
        : {
            url: result.url,
            success: false,
            error: result.error || 'Failed to start job',
          },
    );
    const overallSuccess = launchResults.every((result) => result.success);

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
