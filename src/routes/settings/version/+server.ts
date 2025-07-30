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
  readVersionInfo,
  writeVersionInfo,
  getCurrentVersionFromBinary,
  getLatestVersionFromGithub,
  DEFAULT_VERSION_INFO,
  type VersionInfo,
} from './lib/server-exports';
import { serverLogger as logger } from '$lib/server/logger';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    let versionInfo: VersionInfo = await readVersionInfo();

    // If no current version, get it from binary
    if (versionInfo.current === null) {
      const currentActualVersion = await getCurrentVersionFromBinary();
      if (currentActualVersion) {
        versionInfo.current = currentActualVersion;

        const newInfoToSave = {
          current: currentActualVersion,
          latestAvailable:
            versionInfo.latestAvailable === null ? null : versionInfo.latestAvailable,
          lastChecked: versionInfo.lastChecked === null ? null : versionInfo.lastChecked,
        };
        await writeVersionInfo(newInfoToSave);
        versionInfo = newInfoToSave;
      }
    }
    return json(versionInfo);
  } catch (error) {
    logger.error('Error in version status:', error);
    return json(
      { ...DEFAULT_VERSION_INFO, error: 'Failed to get version status' },
      { status: 500 }
    );
  }
};

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
    logger.error('Error checking for updates:', error);
    return json({ ...DEFAULT_VERSION_INFO, error: 'Failed to check for updates' }, { status: 500 });
  }
};
