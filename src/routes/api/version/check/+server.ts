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
import {
  DEFAULT_VERSION_INFO,
  getCurrentVersionFromBinary,
  getLatestVersionFromGithub,
  readVersionInfo,
  type VersionInfo,
  writeVersionInfo,
} from '$lib/server/versionManager';
import { logger } from '$lib/shared/logger';

export const POST: RequestHandler = async (): Promise<Response> => {
  try {
    const versionInfo: VersionInfo = await readVersionInfo();

    if (versionInfo.current === null) {
      const currentActual: string | null = await getCurrentVersionFromBinary();
      if (currentActual) {
        versionInfo.current = currentActual;
      }
    }

    versionInfo.latestAvailable = await getLatestVersionFromGithub();
    versionInfo.lastChecked = Date.now();

    await writeVersionInfo(versionInfo);

    return json(versionInfo);
  } catch (error) {
    logger.error('Error in /api/version/check:', error);
    return json({ ...DEFAULT_VERSION_INFO, error: 'Failed to check for updates' }, { status: 500 });
  }
};
