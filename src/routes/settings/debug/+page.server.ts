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
import { serverLogger as logger } from '$lib/server/logger';
import type { LoggingConfig } from '$lib/server/loggingManager';
import { writeLoggingConfig, readLoggingConfig } from './lib/server-exports';

const getClientSafeMessage = (error: Error) => {
  if (dev) {
    return error.message;
  }

  if (error.name === 'ValidationError') {
    return 'Invalid input provided.';
  }
  if (error.name === 'NotFoundError') {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
};

export const load: PageServerLoad = async ({ fetch }) => {
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
      const formData: FormData = await request.formData();
      const enabled: boolean = formData.get('enabled') === 'true';
      const level = formData.get('level') as string;

      const currentConfig: LoggingConfig = await readLoggingConfig();

      const newConfig: LoggingConfig = {
        ...currentConfig,
        enabled,
        ...(level && { level: level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' }),
      };

      await writeLoggingConfig(newConfig);
      // Server logger config is updated when database is written

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
