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
  deleteProfileBackup,
  getProfileBackup,
  saveProfileBackup,
  type SelectorProfileBundle,
} from '$lib/server/extensionProfileBackupManager';
import {
  parseTolerantBundleUpsert,
  selectorProfileSchema,
} from '$lib/server/validation/extensionProfiles';

interface AuthContext {
  apiKeyId: string;
  apiKeyName: string | null;
}

const EMPTY_BUNDLE: SelectorProfileBundle = { version: 1, profiles: {} };

const cloneEmptyBundle = (): SelectorProfileBundle => ({ ...EMPTY_BUNDLE, profiles: {} });

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
    logger.warn(`Extension profile backup auth failure: ${authResult.error ?? 'Invalid API key.'}`);
    return { errorResponse: createApiError(authResult.error ?? 'Invalid API key.', 401) };
  }

  return { apiKeyId: authResult.keyInfo.id, apiKeyName: authResult.keyInfo.name || null };
}

export const GET: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const backup = getProfileBackup(auth.apiKeyId);
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

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch (error) {
    logger.warn('Failed to parse JSON payload for selector backup upsert:', error);
    return createApiError('Invalid JSON payload.', 400);
  }

  const parsed = parseTolerantBundleUpsert(rawPayload, selectorProfileSchema);
  if (!parsed.ok) {
    logger.warn(`Selector backup validation failed: ${parsed.message}`);
    return createApiError(parsed.message, 400);
  }

  const { bundle, syncedBy, report } = parsed.value;

  const saved = saveProfileBackup(
    auth.apiKeyId,
    // Raw, unvalidated content is intentional here; the column is an opaque blob.
    bundle as unknown as SelectorProfileBundle,
    syncedBy ?? auth.apiKeyName ?? null,
  );

  if (!saved) {
    return createApiError('Failed to save selector profile backup', 500);
  }

  logger.info(
    `Saved ${saved.profileCount} selector profile(s) backup for extension via API key ${auth.apiKeyId}.`,
  );
  if (report.skipped.count > 0 || report.tolerated.count > 0) {
    logger.warn(
      `Selector backup for API key ${auth.apiKeyId}: skipped ${report.skipped.count} profile(s), stored ${report.tolerated.count} unrecognized profile shape(s).`,
    );
  }

  return createApiResponse({
    hasBackup: true,
    bundle: saved.bundle,
    profileCount: saved.profileCount,
    syncedBy: saved.syncedBy,
    updatedAt: saved.updatedAt,
    skipped: report.skipped,
    tolerated: report.tolerated,
  });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const auth = await authenticate(request);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const deleted = deleteProfileBackup(auth.apiKeyId);
  if (deleted) {
    logger.info(`Deleted selector profile backup for API key ${auth.apiKeyId}.`);
  }

  return createApiResponse({
    deleted,
  });
};
