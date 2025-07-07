/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad, Actions } from './$types';
import { logger, type LoggingConfig } from '$lib/shared/logger';
import { writeLoggingConfig, readLoggingConfig } from '$lib/server/loggingManager';

const getClientSafeMessage = (error: Error) => {
  if (dev) {
    return error.message;
  }

  // Categorize errors for better UX while remaining secure
  if (error.name === 'ValidationError') {
    return 'Invalid input provided.';
  }
  if (error.name === 'NotFoundError') {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
};

export const load: PageServerLoad = async ({ fetch }) => {
  // Use the co-located API endpoint
  try {
    const response = await fetch('/settings/debug');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const config: LoggingConfig = await response.json();
    return {
      success: true,
      config,
    };
  } catch (error) {
    logger.error('Error loading logging config via API:', error);
    return {
      success: false,
      config: { enabled: false, level: 'INFO' } as LoggingConfig,
      error: 'Failed to load logging settings',
    };
  }
};

export const actions: Actions = {
  update: async ({ request }) => {
    try {
      const formData = await request.formData();
      const enabled = formData.get('enabled') === 'true';
      const level = formData.get('level') as string;

      const currentConfig: LoggingConfig = await readLoggingConfig();

      const newConfig: LoggingConfig = {
        ...currentConfig,
        enabled,
        ...(level && { level: level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' }),
      };

      await writeLoggingConfig(newConfig);
      await logger.setConfig(newConfig);

      return {
        success: true,
        config: newConfig,
        message: 'Logging settings updated successfully',
      };
    } catch (error) {
      logger.error('Error updating logging settings:', error);
      return fail(500, {
        error: getClientSafeMessage(error as Error),
        success: false,
      });
    }
  },
};