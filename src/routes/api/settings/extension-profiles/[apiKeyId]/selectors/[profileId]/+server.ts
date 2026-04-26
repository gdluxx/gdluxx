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
} from '$lib/server/extensionProfileBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import { selectorProfileSchema } from '$lib/server/validation/extensionProfiles';

const updateSchema = z.object({
  startSelector: z.string(),
  endSelector: z.string(),
  name: z.string().max(200).optional(),
});

export const PUT: RequestHandler = async ({ request, params, locals }) => {
  try {
    const { apiKeyId, profileId } = params;
    if (!apiKeyId || !profileId) {
      return createApiError('apiKeyId and profileId are required', 400);
    }

    const parseResult = await parseJson(request, updateSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const existing = getProfileBackup(apiKeyId);
    if (!existing?.bundle.profiles[profileId]) {
      return createApiError('Selector profile not found', 404);
    }

    const current = existing.bundle.profiles[profileId];
    const updated: SavedSelectorProfile = {
      ...current,
      startSelector: input.startSelector.trim(),
      endSelector: input.endSelector.trim(),
      name: input.name?.trim() || undefined,
      updatedAt: Date.now(),
    };

    const validation = selectorProfileSchema.safeParse(updated);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid profile';
      return createApiError(message, 400);
    }

    existing.bundle.profiles[profileId] = updated;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveProfileBackup(apiKeyId, existing.bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to save selector profile', 500);
    }

    logger.info(`Updated selector profile ${profileId} for API key ${apiKeyId}`);
    return createApiResponse({ profile: updated });
  } catch (error) {
    logger.error('Error updating selector profile:', error);
    return handleApiError(new Error('Failed to update selector profile'));
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const { apiKeyId, profileId } = params;
    if (!apiKeyId || !profileId) {
      return createApiError('apiKeyId and profileId are required', 400);
    }

    const existing = getProfileBackup(apiKeyId);
    if (!existing?.bundle.profiles[profileId]) {
      return createApiResponse({ deleted: false });
    }

    const nextProfiles = { ...existing.bundle.profiles };
    Reflect.deleteProperty(nextProfiles, profileId);
    existing.bundle.profiles = nextProfiles;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveProfileBackup(apiKeyId, existing.bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to delete selector profile', 500);
    }

    logger.info(`Deleted selector profile ${profileId} for API key ${apiKeyId}`);
    return createApiResponse({ deleted: true });
  } catch (error) {
    logger.error('Error deleting selector profile:', error);
    return handleApiError(new Error('Failed to delete selector profile'));
  }
};
