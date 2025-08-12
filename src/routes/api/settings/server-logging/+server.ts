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
  validateLogDirectory,
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

    if (config.fileEnabled) {
      const validation = validateLogDirectory(config.fileDirectory);
      if (!validation.valid) {
        return json({ error: validation.error }, { status: 400 });
      }
    }

    if (config.slowQueryThreshold < 0) {
      return json({ error: 'Slow query threshold must be a positive number' }, { status: 400 });
    }

    if (!['debug', 'info', 'warn', 'error'].includes(config.level)) {
      return json({ error: 'Invalid log level' }, { status: 400 });
    }

    if (!['json', 'simple'].includes(config.format)) {
      return json({ error: 'Invalid log format' }, { status: 400 });
    }

    await writeServerLoggingConfig(config);

    await serverLogger.updateConfig(config);

    serverLogger.info('Server logging configuration updated', { config });
    return json({ success: true });
  } catch (error) {
    serverLogger.error('Failed to update server logging config:', error);
    return json({ error: 'Failed to update server logging configuration' }, { status: 500 });
  }
};
