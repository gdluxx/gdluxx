import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  readVersionInfo,
  writeVersionInfo,
  getCurrentVersionFromBinary,
  DEFAULT_VERSION_INFO,
  type VersionInfo,
} from '$lib/server/versionManager';
import { logger } from '$lib/shared/logger';

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
    logger.error('Error in /api/version/status:', error);
    return json(
      { ...DEFAULT_VERSION_INFO, error: 'Failed to get version status' },
      { status: 500 }
    );
  }
};
