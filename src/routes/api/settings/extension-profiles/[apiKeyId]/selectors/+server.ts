/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { z } from 'zod';
import type { RequestHandler } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import {
  getProfileBackup,
  saveProfileBackup,
  type SavedSelectorProfile,
  type SelectorProfileBundle,
} from '$lib/server/extensionProfileBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import { selectorProfileSchema } from '$lib/server/validation/extensionProfiles';
import {
  buildProfileId,
  normaliseHost,
  normaliseOrigin,
  normalisePath,
} from '$lib/extensionProfiles/profileId';

const profileScopeSchema = z.enum(['host', 'origin', 'path']);

const createSchema = z.object({
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  path: z.string().optional(),
  origin: z.string().optional(),
  startSelector: z.string().default(''),
  endSelector: z.string().default(''),
  name: z.string().max(200).optional(),
});

function emptyBundle(): SelectorProfileBundle {
  return { version: 1, profiles: {} };
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
  try {
    const apiKeyId = params.apiKeyId;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const parseResult = await parseJson(request, createSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const host = normaliseHost(input.host);
    const origin = input.scope === 'host' ? undefined : normaliseOrigin(input.origin);
    const path = input.scope === 'path' ? (normalisePath(input.path) ?? '/') : undefined;
    const id = buildProfileId(input.scope, host, origin, path);

    const existing = getProfileBackup(apiKeyId);
    const bundle = existing?.bundle ?? emptyBundle();

    if (bundle.profiles[id]) {
      return createApiError('A profile with this scope/host/path already exists.', 409);
    }

    const now = Date.now();
    const newProfile: SavedSelectorProfile = {
      id,
      scope: input.scope,
      host,
      origin,
      path,
      startSelector: input.startSelector.trim(),
      endSelector: input.endSelector.trim(),
      name: input.name?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const validation = selectorProfileSchema.safeParse(newProfile);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid profile';
      return createApiError(message, 400);
    }

    bundle.profiles[id] = newProfile;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveProfileBackup(apiKeyId, bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to save selector profile', 500);
    }

    logger.info(`Created selector profile ${id} for API key ${apiKeyId}`);
    return createApiResponse({ profile: newProfile });
  } catch (error) {
    logger.error('Error creating selector profile:', error);
    return handleApiError(new Error('Failed to create selector profile'));
  }
};
