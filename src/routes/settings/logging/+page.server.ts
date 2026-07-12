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
import { readServerLoggingConfig, type ServerLoggingConfig } from '$lib/server/loggingManager';

// NOTE: This does not use `createPageLoad` (see $lib/utils/page-load.ts) because
// GET /api/settings/server-logging returns a bare ServerLoggingConfig object
// instead of the standard { success, data } envelope. createPageLoad assumes the envelope
// shape, so reusing it here would misreport every successful load as a failure.
// Reading the config directly via the manager (the same function the endpoint
// itself calls) avoids an unnecessary internal HTTP round trip and still moves
// this data into the server load so the client no longer has to fetch it onMount.
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
