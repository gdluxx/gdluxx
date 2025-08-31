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
  getLatestVersionFromGithub,
  getCurrentVersionFromBinary,
  downloadAndInstallBinary,
  compareVersions,
  DEFAULT_VERSION_INFO,
  type VersionInfo,
} from '../lib/server-exports';
import { serverLogger as logger } from '$lib/server/logger';

export const POST: RequestHandler = async (): Promise<Response> => {
  try {
    const versionInfo: VersionInfo = await readVersionInfo();
    const currentVersionOnServer: string | null =
      versionInfo.current ?? (await getCurrentVersionFromBinary());

    const latestVersionFromGithub: string | null =
      versionInfo.latestAvailable ?? (await getLatestVersionFromGithub());

    if (!latestVersionFromGithub) {
      return json(
        { ...versionInfo, error: 'Could not determine latest version from GitHub.' },
        { status: 500 },
      );
    }

    if (
      currentVersionOnServer &&
      compareVersions(latestVersionFromGithub, currentVersionOnServer) <= 0
    ) {
      versionInfo.current = currentVersionOnServer;
      versionInfo.latestAvailable = latestVersionFromGithub;
      versionInfo.lastChecked = Date.now();
      await writeVersionInfo(versionInfo);
      return json({ ...versionInfo, message: 'Already up to date.' });
    }

    logger.info(
      `Updating from ${currentVersionOnServer ?? 'unknown'} to ${latestVersionFromGithub}`,
    );
    const downloadSuccess: boolean = await downloadAndInstallBinary();

    if (!downloadSuccess) {
      return json(
        { ...versionInfo, error: 'Binary download or installation failed.' },
        { status: 500 },
      );
    }

    const newlyInstalledVersion: string | null = await getCurrentVersionFromBinary();
    if (!newlyInstalledVersion) {
      // This is bad, download might have failed
      versionInfo.current = null; // Mark as unknown

      await writeVersionInfo(versionInfo);
      return json(versionInfo, { status: 500 });
    }

    versionInfo.current = newlyInstalledVersion;
    versionInfo.latestAvailable = latestVersionFromGithub;
    versionInfo.lastChecked = Date.now();
    await writeVersionInfo(versionInfo);

    return json({ ...versionInfo, message: 'Update completed successfully.' });
  } catch (error) {
    logger.error('Error in update:', error);
    const currentInfo: VersionInfo = await readVersionInfo().catch(() => DEFAULT_VERSION_INFO);
    return json(
      {
        ...currentInfo,
        error: error instanceof Error ? error.message : 'Update failed due to an unknown error.',
      },
      { status: 500 },
    );
  }
};
