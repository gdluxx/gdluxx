/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { PageServerLoad } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { readServerLoggingConfig } from '$lib/server/loggingManager';
import type { ServerLoggingConfig } from '$lib/logging';

// NOTE: GET /api/settings/server-logging now returns the standard
// { success, data } envelope, so `createPageLoad` (see $lib/utils/page-load.ts)
// would work here. It is deliberately not used: `createPageLoad` spreads
// `data` into the page payload, which would flatten the config's ten fields
// into the top level, and it would cost an internal HTTP round trip to reach
// the very function this load already calls. Reading through the manager keeps
// `serverConfig` a single nested object and keeps the fetch off the client.
export const load: PageServerLoad = async () => {
  try {
    const serverConfig: ServerLoggingConfig = await readServerLoggingConfig();
    return {
      success: true,
      serverConfig,
    };
  } catch (error) {
    logger.error('Error loading server logging config:', error);
    return {
      success: false,
      serverConfig: null,
      error: 'Failed to load server logging configuration',
    };
  }
};
