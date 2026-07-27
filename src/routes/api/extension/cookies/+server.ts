/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { validateApiKey } from '$lib/server/auth/apiAuth';
import {
  CookieBackupLimitError,
  deleteCookieBackup,
  getCookieBackup,
  normalizeCookieDomain,
  saveCookieDomain,
  toCookieBackupMetadata,
} from '$lib/server/cookieBackupManager';
import { removeCachedCookieFile } from '$lib/server/cookieFileManager';
import { parseJson } from '$lib/server/validation/zod';
import {
  cookieUpsertSchema,
  type CookieUpsertPayload,
} from '$lib/server/validation/extensionCookies';

interface AuthContext {
  apiKeyId: string;
  apiKeyName: string | null;
}

async function authenticate(request: Request): Promise<AuthContext | { errorResponse: Response }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: createApiError('Authorization header with Bearer token is required', 401),
    };
  }

  const plainApiKey = authHeader.substring(7).trim();
  if (!plainApiKey) {
    return { errorResponse: createApiError('Bearer token cannot be empty', 400) };
  }

  const authResult = await validateApiKey(plainApiKey);
  if (!authResult.success || !authResult.keyInfo) {
    logger.warn(`Extension cookie backup auth failure: ${authResult.error ?? 'Invalid API key.'}`);
    return { errorResponse: createApiError(authResult.error ?? 'Invalid API key.', 401) };
  }

  return { apiKeyId: authResult.keyInfo.id, apiKeyName: authResult.keyInfo.name || null };
}

export const GET: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const backup = getCookieBackup(auth.apiKeyId);
  return createApiResponse(toCookieBackupMetadata(backup));
};

export const PUT: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const parseResult = await parseJson(request, cookieUpsertSchema);
  if ('errorResponse' in parseResult) {
    return parseResult.errorResponse;
  }

  const payload: CookieUpsertPayload = parseResult.data;

  let saved;
  try {
    saved = saveCookieDomain(
      auth.apiKeyId,
      payload.domain,
      payload.cookies,
      payload.syncedBy ?? auth.apiKeyName ?? null,
    );
  } catch (error) {
    if (error instanceof CookieBackupLimitError) {
      const status = error.message.includes('required') ? 400 : 413;
      return createApiError(error.message, status);
    }
    throw error;
  }

  if (!saved) {
    return createApiError('Failed to save cookie backup', 500);
  }

  logger.info(
    `Saved cookie domain "${normalizeCookieDomain(payload.domain)}" backup for extension via API key ${auth.apiKeyId}.`,
  );

  return createApiResponse(toCookieBackupMetadata(saved));
};

export const DELETE: RequestHandler = async ({ request, url }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const domainParam = url.searchParams.get('domain')?.trim() || undefined;
  const existing = getCookieBackup(auth.apiKeyId);
  const domainsToUnlink = domainParam
    ? [normalizeCookieDomain(domainParam)]
    : Object.keys(existing?.bundle.domains ?? {});

  const deleted = deleteCookieBackup(auth.apiKeyId, domainParam);

  if (deleted) {
    for (const domain of domainsToUnlink) {
      await removeCachedCookieFile(domain);
    }
    logger.info(
      domainParam
        ? `Deleted cookie domain "${normalizeCookieDomain(domainParam)}" for API key ${auth.apiKeyId}.`
        : `Deleted cookie backup for API key ${auth.apiKeyId}.`,
    );
  }

  return createApiResponse({ deleted });
};
