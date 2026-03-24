/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestHandler } from './$types';
import {
  readVersionInfo,
  writeVersionInfo,
  getLatestVersionFromGithub,
  getCurrentVersionFromBinary,
  checkBinaryExists,
  downloadAndInstallBinary,
  compareVersions,
  DEFAULT_VERSION_INFO,
  type VersionInfo,
} from '$lib/server/version/versionManager';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse } from '$lib/server/api-utils';

export const POST: RequestHandler = async (): Promise<Response> => {
  try {
    const versionInfo: VersionInfo = await readVersionInfo();
    const binaryExists: boolean = await checkBinaryExists();

    const currentVersionOnServer: string | null = binaryExists
      ? (versionInfo.current ?? (await getCurrentVersionFromBinary()))
      : null;

    const latestVersionFromGithub: string | null =
      versionInfo.latestAvailable ?? (await getLatestVersionFromGithub());

    if (!latestVersionFromGithub) {
      return createApiError('Could not determine latest version from GitHub.', 500);
    }

    // Only skip the download if the binary actually exists on disk AND the version is already current
    if (
      binaryExists &&
      currentVersionOnServer &&
      compareVersions(latestVersionFromGithub, currentVersionOnServer) <= 0
    ) {
      versionInfo.current = currentVersionOnServer;
      versionInfo.latestAvailable = latestVersionFromGithub;
      versionInfo.lastChecked = Date.now();
      await writeVersionInfo(versionInfo);
      return createApiResponse({
        ...versionInfo,
        binaryExists: true,
        message: 'Already up to date.',
      });
    }

    logger.info(
      `Updating from ${currentVersionOnServer ?? 'unknown'} to ${latestVersionFromGithub}`,
    );
    const downloadSuccess: boolean = await downloadAndInstallBinary();

    if (!downloadSuccess) {
      return createApiError('Binary download or installation failed.', 500);
    }

    const newlyInstalledVersion: string | null = await getCurrentVersionFromBinary();
    if (!newlyInstalledVersion) {
      // This is bad, download might have failed
      versionInfo.current = null; // Mark as unknown

      await writeVersionInfo(versionInfo);
      return createApiError('Update completed but version could not be determined.', 500);
    }

    versionInfo.current = newlyInstalledVersion;
    versionInfo.latestAvailable = latestVersionFromGithub;
    versionInfo.lastChecked = Date.now();
    await writeVersionInfo(versionInfo);

    return createApiResponse({
      ...versionInfo,
      binaryExists: true,
      message: 'Update completed successfully.',
    });
  } catch (error) {
    logger.error('Error in update:', error);
    await readVersionInfo().catch(() => DEFAULT_VERSION_INFO);
    return createApiError(
      error instanceof Error ? error.message : 'Update failed due to an unknown error.',
      500,
    );
  }
};
