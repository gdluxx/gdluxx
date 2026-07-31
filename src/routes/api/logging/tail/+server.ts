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
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { readLogTail } from '$lib/server/logTail';
import { readServerLoggingConfig } from '$lib/server/loggingManager';
import type { LogTailResult } from '$lib/logging';

// Read-only tail of the most recent server log file.

export const GET: RequestHandler = async ({ locals }) => {
  try {
    if (!locals.user) {
      return createApiError('Authentication required', 401);
    }

    const config = await readServerLoggingConfig();
    const tail = await readLogTail(config);

    const response = createApiResponse<LogTailResult>(tail);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    logger.error('Failed to read log tail:', error);
    return createApiError('Failed to read the log file', 500);
  }
};
