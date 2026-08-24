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
import { getCookieBackup, toCookieBackupMetadata } from '$lib/server/cookieBackupManager';
import type { ApiKeySummary, CookieBackupView, CookiesPageData } from '$lib/cookieBackups/types';
import { requireUser } from '$lib/server/auth/requireUser';

export const GET: RequestHandler = async ({ locals }): Promise<Response> => {
  const user = requireUser(locals);
  try {
    const apiKeys = await listApiKeys(user.id);

    const summaries: ApiKeySummary[] = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
    }));

    const cookieBackups: Record<string, CookieBackupView> = {};

    for (const key of summaries) {
      const backup = getCookieBackup(key.id);
      cookieBackups[key.id] = toCookieBackupMetadata(backup);
    }

    const payload: CookiesPageData = {
      apiKeys: summaries,
      cookieBackups,
    };

    const resp = createApiResponse(payload);
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    logger.error('Error loading cookie backups:', error);
    return handleApiError(new Error('Failed to load cookie backups'));
  }
};
