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
import { z } from 'zod';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { validateApiKey } from '$lib/server/auth/apiAuth';
import {
  deleteProfileBackup,
  getProfileBackup,
  saveProfileBackup,
  type SavedSelectorProfile,
  type SelectorProfileBundle,
} from '$lib/server/extensionProfileBackupManager';
import { parseJson } from '$lib/server/validation/zod';

interface AuthContext {
  apiKeyId: string;
  apiKeyName: string | null;
}

const selectorProfileSchema: z.ZodType<SavedSelectorProfile> = z.object({
  id: z.string().min(1, 'Profile id is required'),
  scope: z.enum(['host', 'origin', 'path']),
  host: z.string().min(1, 'Host is required'),
  path: z.string().optional(),
  origin: z.string().optional(),
  startSelector: z.string(),
  endSelector: z.string(),
  name: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  lastUsed: z.number().int().optional(),
});

const bundleSchema: z.ZodType<SelectorProfileBundle> = z.object({
  version: z.number().int().nonnegative(),
  profiles: z.record(z.string(), selectorProfileSchema),
});

const upsertSchema = z.object({
  bundle: bundleSchema,
  syncedBy: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(200))
    .optional(),
});

type UpsertPayload = z.infer<typeof upsertSchema>;

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

  const parseResult = await parseJson(request, upsertSchema);
  if ('errorResponse' in parseResult) {
    return parseResult.errorResponse;
  }

  const payload: UpsertPayload = parseResult.data;

  const saved = saveProfileBackup(
    auth.apiKeyId,
    payload.bundle,
    payload.syncedBy ?? auth.apiKeyName ?? null,
  );

  if (!saved) {
    return createApiError('Failed to save selector profile backup', 500);
  }

  logger.info(
    `Saved ${saved.profileCount} selector profile(s) backup for extension via API key ${auth.apiKeyId}.`,
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

  const deleted = deleteProfileBackup(auth.apiKeyId);
  if (deleted) {
    logger.info(`Deleted selector profile backup for API key ${auth.apiKeyId}.`);
  }

  return createApiResponse({
    deleted,
  });
};
