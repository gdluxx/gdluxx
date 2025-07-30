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
import type { RequestHandler } from './$types';
import { serverLogger } from '$lib/server/logger';
import {
  readServerLoggingConfig,
  writeServerLoggingConfig,
  type ServerLoggingConfig,
} from '$lib/server/loggingManager';

export const GET: RequestHandler = async () => {
  try {
    const config = await readServerLoggingConfig();
    return json(config);
  } catch (error) {
    serverLogger.error('Failed to get server logging config:', error);
    return json({ error: 'Failed to load server logging configuration' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const config: ServerLoggingConfig = await request.json();

    await writeServerLoggingConfig(config);

    await serverLogger.updateConfig({
      enabled: config.enabled,
      level: config.level,
      format: config.format,
      outputs: {
        console: config.consoleEnabled,
        file: {
          enabled: config.fileEnabled,
          directory: config.fileDirectory,
          maxSize: config.fileMaxSize,
          maxFiles: config.fileMaxFiles,
        },
        database: false,
      },
      performance: {
        logSlowQueries: config.performanceLogging,
        slowQueryThreshold: config.slowQueryThreshold,
      },
    });

    serverLogger.info('Server logging configuration updated', { config });
    return json({ success: true });
  } catch (error) {
    serverLogger.error('Failed to update server logging config:', error);
    return json({ error: 'Failed to update server logging configuration' }, { status: 500 });
  }
};
