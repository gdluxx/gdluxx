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
import { serverLogger as logger } from '$lib/server/logger';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { listApiKeys } from '$lib/server/apikey';
import { getProfileBackup } from '$lib/server/extensionProfileBackupManager';
import { getSubBackup } from '$lib/server/extensionSubBackupManager';
import type {
  ApiKeySummary,
  ExtensionProfilesPageData,
  SelectorBackupView,
  SelectorBundle,
  SubBackupView,
  SubBundle,
} from '$lib/extensionProfiles/types';

const emptySelectorBundle: SelectorBundle = { version: 1, profiles: {} };
const emptySubBundle: SubBundle = { version: 1, profiles: {} };

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const apiKeys = await listApiKeys();

    const summaries: ApiKeySummary[] = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
    }));

    const selectorBackups: Record<string, SelectorBackupView> = {};
    const subBackups: Record<string, SubBackupView> = {};

    for (const key of summaries) {
      const selectorBackup = getProfileBackup(key.id);
      if (selectorBackup) {
        selectorBackups[key.id] = {
          hasBackup: true,
          profileCount: selectorBackup.profileCount,
          syncedBy: selectorBackup.syncedBy,
          updatedAt: selectorBackup.updatedAt,
          bundle: selectorBackup.bundle,
        };
      } else {
        selectorBackups[key.id] = {
          hasBackup: false,
          profileCount: 0,
          syncedBy: null,
          updatedAt: null,
          bundle: { ...emptySelectorBundle, profiles: {} },
        };
      }

      const subBackup = getSubBackup(key.id);
      if (subBackup) {
        subBackups[key.id] = {
          hasBackup: true,
          profileCount: subBackup.profileCount,
          syncedBy: subBackup.syncedBy,
          updatedAt: subBackup.updatedAt,
          bundle: subBackup.bundle,
        };
      } else {
        subBackups[key.id] = {
          hasBackup: false,
          profileCount: 0,
          syncedBy: null,
          updatedAt: null,
          bundle: { ...emptySubBundle, profiles: {} },
        };
      }
    }

    const payload: ExtensionProfilesPageData = {
      apiKeys: summaries,
      selectorBackups,
      subBackups,
    };

    const resp = createApiResponse(payload);
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    logger.error('Error loading extension profile backups:', error);
    return handleApiError(new Error('Failed to load extension profile backups'));
  }
};
