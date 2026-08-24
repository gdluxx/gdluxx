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
import { serverLogger } from '$lib/server/logger';
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { parseJson } from '$lib/server/validation/zod';
import { serverLoggingConfigSchema, type ServerLoggingConfig } from '$lib/logging';
import { readServerLoggingConfig, writeServerLoggingConfig } from '$lib/server/loggingManager';
import { requireUser } from '$lib/server/auth/requireUser';

export const GET: RequestHandler = async ({ locals }) => {
  requireUser(locals);
  try {
    const config = await readServerLoggingConfig();
    return createApiResponse<ServerLoggingConfig>(config);
  } catch (error) {
    serverLogger.error('Failed to get server logging config:', error);
    return createApiError('Failed to load server logging configuration', 500);
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  requireUser(locals);
  try {
    // Validated before anything is persisted. A bad fileMaxSize/fileMaxFiles
    // used to reach SQLite first and only blow up when the transport was
    // rebuilt leaving a stored config that breaks file logging on every boot
    const parsed = await parseJson(request, serverLoggingConfigSchema);
    if ('errorResponse' in parsed) {
      return parsed.errorResponse;
    }

    const config: ServerLoggingConfig = parsed.data;
    const previousConfig = await readServerLoggingConfig();

    await writeServerLoggingConfig(config);

    try {
      await serverLogger.updateConfig(config);
    } catch (transportError) {
      serverLogger.error('Failed to apply logging configuration, rolling back:', transportError);

      try {
        await writeServerLoggingConfig(previousConfig);
        await serverLogger.updateConfig(previousConfig);
      } catch (rollbackError) {
        serverLogger.error('Failed to roll back logging configuration:', rollbackError);
      }

      return createApiError(
        'Logging configuration could not be applied and was reverted. Check the file output settings.',
        500,
      );
    }

    serverLogger.info('Server logging configuration updated');
    return createApiResponse<ServerLoggingConfig>(await readServerLoggingConfig());
  } catch (error) {
    serverLogger.error('Failed to update server logging config:', error);
    return createApiError('Failed to update server logging configuration', 500);
  }
};
