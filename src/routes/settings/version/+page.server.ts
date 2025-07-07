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
import type { PageServerLoad, Actions } from './$types';
import { logger } from '$lib/shared/logger';
import { DEFAULT_VERSION_INFO, type VersionInfo } from '$lib/server/versionManager';

export const load: PageServerLoad = async ({ fetch }) => {
  // Use the co-located API endpoint
  try {
    const response = await fetch('/settings/version');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const versionInfo: VersionInfo = await response.json();
    return {
      success: true,
      versionInfo,
    };
  } catch (error) {
    logger.error('Error loading version info via API:', error);
    return {
      success: false,
      versionInfo: DEFAULT_VERSION_INFO,
      error: 'Failed to load version information',
    };
  }
};

export const actions: Actions = {
  checkForUpdates: async ({ fetch }) => {
    try {
      const response = await fetch('/settings/version', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        return fail(response.status, {
          error: data.error || 'Failed to check for updates',
          success: false,
        });
      }

      const versionInfo: VersionInfo = await response.json();
      return {
        success: true,
        versionInfo,
        message: 'Update check completed',
      };
    } catch (error) {
      logger.error('Error checking for updates:', error);
      return fail(500, {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }
  },

  update: async ({ fetch }) => {
    try {
      const response = await fetch('/settings/version/update', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        return fail(response.status, {
          error: data.error || 'Update failed',
          success: false,
        });
      }

      const result: VersionInfo & { message?: string } = await response.json();
      return {
        success: true,
        versionInfo: {
          current: result.current,
          latestAvailable: result.latestAvailable,
          lastChecked: result.lastChecked,
        },
        message: result.message || 'Update completed successfully',
      };
    } catch (error) {
      logger.error('Error updating binary:', error);
      return fail(500, {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    }
  },
};