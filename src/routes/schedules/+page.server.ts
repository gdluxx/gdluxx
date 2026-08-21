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
import type { ScheduleSummary } from '$lib/types/schedules';

// GET /api/schedules returns { success, data: ScheduleSummary[] } — a bare
// array. createPageLoad (see $lib/utils/page-load.ts) spreads `data` into the
// page payload, which for an array produces numeric-keyed properties instead
// of a `schedules` field, so it is not used here (same reasoning as
// settings/logging/+page.server.ts, for the opposite — object-shaped — case).
export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch('/api/schedules');
    const apiResponse = await response.json();

    if (response.ok && apiResponse.success && Array.isArray(apiResponse.data)) {
      return { success: true, schedules: apiResponse.data as ScheduleSummary[] };
    }

    return {
      success: false,
      schedules: [] as ScheduleSummary[],
      error: apiResponse.error ?? 'Failed to load schedules',
    };
  } catch (error) {
    logger.error('Error loading /api/schedules:', error);
    return {
      success: false,
      schedules: [] as ScheduleSummary[],
      error: 'Failed to load schedules',
    };
  }
};
