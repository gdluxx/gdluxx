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
import { serverLogger } from '$lib/server/logger';
import type { RequestHandler } from './$types';

interface ClientLogEntry {
  timestamp: string;
  level: string;
  message: string;
  args: unknown[];
  url?: string;
  userAgent?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { logs } = await request.json();

    if (!Array.isArray(logs)) {
      return json({ error: 'Invalid logs format' }, { status: 400 });
    }

    // Log each client log entry to server logger
    logs.forEach((entry: ClientLogEntry) => {
      const message = `[CLIENT] ${entry.message}`;
      const metadata = {
        clientTimestamp: entry.timestamp,
        url: entry.url,
        userAgent: entry.userAgent,
        args: entry.args,
      };

      switch (entry.level.toLowerCase()) {
        case 'debug':
          serverLogger.debug(message, metadata);
          break;
        case 'info':
          serverLogger.info(message, metadata);
          break;
        case 'warn':
          serverLogger.warn(message, metadata);
          break;
        case 'error':
          serverLogger.error(message, metadata);
          break;
        default:
          serverLogger.info(message, metadata);
      }
    });

    return json({ success: true, processed: logs.length });
  } catch (error) {
    serverLogger.error('Failed to process client logs', { error });
    return json({ error: 'Failed to process logs' }, { status: 500 });
  }
};
