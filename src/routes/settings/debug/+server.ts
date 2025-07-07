/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { logger, type LoggingConfig } from '$lib/shared/logger';
import { readLoggingConfig, writeLoggingConfig } from '$lib/server/loggingManager';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    logger.info('[API TRACE] GET /settings/debug invoked.');

    const config: LoggingConfig = await readLoggingConfig();
    await logger.setConfig(config);

    logger.info(`[API TRACE] Config to be returned by API to client: ${JSON.stringify(config)}`);

    return json(config);
  } catch (e) {
    logger.error('[API LoggingSettings GET] Error:', e);
    return json({ error: 'Failed to retrieve logging settings' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  try {
    const body = (await request.json()) as Partial<LoggingConfig>;

    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'Invalid payload: "enabled" must be a boolean.' }, { status: 400 });
    }

    const currentConfig: LoggingConfig = await readLoggingConfig();

    const newConfig: LoggingConfig = {
      ...currentConfig,
      enabled: body.enabled,
      ...(body.level && { level: body.level }),
    };

    await writeLoggingConfig(newConfig);
    await logger.setConfig(newConfig);

    return json(newConfig);
  } catch (e) {
    logger.error('[API LoggingSettings POST] Error:', e);
    return json({ error: 'Failed to update logging settings' }, { status: 500 });
  }
};