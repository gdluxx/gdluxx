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
import { logger } from '$lib/shared/logger';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch('/jobs');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Error loading jobs via API:', error);
    return {
      success: false,
      jobs: [],
      error: 'Failed to load jobs',
    };
  }
};
