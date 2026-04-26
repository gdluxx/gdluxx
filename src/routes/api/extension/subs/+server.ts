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
  deleteSubBackup,
  getSubBackup,
  saveSubBackup,
  type SubProfileBundle,
} from '$lib/server/extensionSubBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import {
  subBundleUpsertSchema,
  type SubBundleUpsertPayload,
} from '$lib/server/validation/extensionProfiles';

interface AuthContext {
  apiKeyId: string;
  apiKeyName: string | null;
}

const EMPTY_BUNDLE: SubProfileBundle = { version: 1, profiles: {} };

const cloneEmptyBundle = (): SubProfileBundle => ({ ...EMPTY_BUNDLE, profiles: {} });

const emptyResponse = () =>
  createApiResponse({
    hasBackup: false,
    profileCount: 0,
    bundle: cloneEmptyBundle(),
    syncedBy: null,
    updatedAt: null,
  });

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
    logger.warn(`Extension sub backup auth failure: ${authResult.error ?? 'Invalid API key.'}`);
    return { errorResponse: createApiError(authResult.error ?? 'Invalid API key.', 401) };
  }

  return { apiKeyId: authResult.keyInfo.id, apiKeyName: authResult.keyInfo.name || null };
}

export const GET: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const backup = getSubBackup(auth.apiKeyId);
  if (!backup) {
    return emptyResponse();
  }

  return createApiResponse({
    hasBackup: true,
    bundle: backup.bundle,
    profileCount: backup.profileCount,
    syncedBy: backup.syncedBy,
    updatedAt: backup.updatedAt,
  });
};

export const PUT: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const parseResult = await parseJson(request, subBundleUpsertSchema);
  if ('errorResponse' in parseResult) {
    return parseResult.errorResponse;
  }

  const payload: SubBundleUpsertPayload = parseResult.data;

  const saved = saveSubBackup(
    auth.apiKeyId,
    payload.bundle,
    payload.syncedBy ?? auth.apiKeyName ?? null,
  );

  if (!saved) {
    return createApiError('Failed to save substitution profile backup', 500);
  }

  logger.info(
    `Saved ${saved.profileCount} substitution profile(s) backup for extension via API key ${auth.apiKeyId}.`,
  );

  return createApiResponse({
    hasBackup: true,
    bundle: saved.bundle,
    profileCount: saved.profileCount,
    syncedBy: saved.syncedBy,
    updatedAt: saved.updatedAt,
  });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const deleted = deleteSubBackup(auth.apiKeyId);
  if (deleted) {
    logger.info(`Deleted substitution profile backup for API key ${auth.apiKeyId}.`);
  }

  return createApiResponse({
    deleted,
  });
};
