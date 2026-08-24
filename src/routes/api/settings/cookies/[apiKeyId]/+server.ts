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
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import { listApiKeys } from '$lib/server/apikey';
import {
  deleteCookieBackup,
  getCookieBackup,
  normalizeCookieDomain,
} from '$lib/server/cookieBackupManager';
import { removeCachedCookieFile } from '$lib/server/cookieFileManager';
import { requireUser } from '$lib/server/auth/requireUser';

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
  const user = requireUser(locals);
  try {
    const { apiKeyId } = params;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const apiKeys = await listApiKeys(user.id);
    if (!apiKeys.some((k) => k.id === apiKeyId)) {
      return createApiError('API key not found', 404);
    }

    const domainParam = url.searchParams.get('domain')?.trim() || undefined;
    const existing = getCookieBackup(apiKeyId);
    const domainsToUnlink = domainParam
      ? [normalizeCookieDomain(domainParam)]
      : Object.keys(existing?.bundle.domains ?? {});

    const deleted = deleteCookieBackup(apiKeyId, domainParam);

    if (deleted) {
      for (const domain of domainsToUnlink) {
        await removeCachedCookieFile(domain);
      }
      logger.info(
        domainParam
          ? `Deleted cookie domain "${normalizeCookieDomain(domainParam)}" for API key ${apiKeyId} via settings.`
          : `Deleted cookie backup for API key ${apiKeyId} via settings.`,
      );
    }

    return createApiResponse({ deleted });
  } catch (error) {
    logger.error('Error deleting cookie backup:', error);
    return handleApiError(new Error('Failed to delete cookie backup'));
  }
};
