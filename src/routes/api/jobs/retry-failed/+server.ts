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
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { requireUser } from '$lib/server/auth/requireUser';
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { BinaryUnavailableError, launchUrls } from '$lib/server/jobs/commandLauncher';
import { jobManager } from '$lib/server/jobs/jobManager';
import { ConfigExecutionBlockedError, ProhibitedOptionError } from '$lib/server/validation/exec-policy';

export const POST: RequestHandler = async ({ locals }): Promise<Response> => {
  requireUser(locals);

  try {
    // Snapshot IDs before retrying, since each accepted retry leaves the error
    // set and becomes waiting or running.
    const failedJobIds = await jobManager.getJobIdsByStatus('error');
    const results: Array<{ jobId: string; success: boolean; status?: 'waiting' | 'running'; error?: string }> = [];

    for (const jobId of failedJobIds) {
      const url = await jobManager.prepareJobRetry(jobId);
      if (!url) {
        results.push({ jobId, success: false, error: 'Job is no longer failed' });
        continue;
      }

      try {
        const siteOptions = await siteConfigManager.getCliOptionsForUrl(url);
        const launched = await launchUrls({
          urls: [url],
          args: siteOptions,
          excludedOptions: [],
          resolveSiteOptions: async () => [],
          retryJobId: jobId,
        });
        const result = launched[0];
        if (result?.success) {
          results.push({ jobId, success: true, status: result.status ?? 'waiting' });
        } else {
          await jobManager.completeJob(jobId, 1);
          results.push({ jobId, success: false, error: result?.error ?? 'Failed to retry job' });
        }
      } catch (error) {
        await jobManager.completeJob(jobId, 1);
        const message = error instanceof Error ? error.message : 'Failed to retry job';
        results.push({ jobId, success: false, error: message });

        // These errors apply to every remaining retry, so stop the batch after
        // the current job has been restored to its failed state.
        if (
          error instanceof BinaryUnavailableError ||
          error instanceof ProhibitedOptionError ||
          error instanceof ConfigExecutionBlockedError
        ) {
          break;
        }
      }
    }

    return createApiResponse({
      total: failedJobIds.length,
      accepted: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
