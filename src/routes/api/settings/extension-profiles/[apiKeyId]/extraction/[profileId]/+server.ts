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
import {
  getExtractionBackup,
  saveExtractionBackup,
  type SavedExtractionProfile,
} from '$lib/server/extensionExtractionBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import {
  extractionProfileSchema,
  extractionProfileUpdateSchema,
  normaliseRuleInputs,
} from '$lib/server/validation/extensionProfiles';

export const PUT: RequestHandler = async ({ request, params, locals }) => {
  try {
    const { apiKeyId, profileId } = params;
    if (!apiKeyId || !profileId) {
      return createApiError('apiKeyId and profileId are required', 400);
    }

    const parseResult = await parseJson(request, extractionProfileUpdateSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const existing = getExtractionBackup(apiKeyId);
    if (!existing?.bundle.profiles[profileId]) {
      return createApiError('Extraction profile not found', 404);
    }

    const current = existing.bundle.profiles[profileId];
    const updated: SavedExtractionProfile = {
      ...current,
      name: input.name?.trim() || undefined,
      extraction: input.extraction,
      rules: normaliseRuleInputs(input.rules),
      applyToPreview: input.applyToPreview,
      autoApply: input.autoApply,
      // Assigned explicitly so omitting gallery in the request clears the
      // stored override (undefined is dropped on JSON serialization).
      gallery: input.gallery,
      updatedAt: Date.now(),
    };

    const validation = extractionProfileSchema.safeParse(updated);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid profile';
      return createApiError(message, 400);
    }

    existing.bundle.profiles[profileId] = updated;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveExtractionBackup(apiKeyId, existing.bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to save extraction profile', 500);
    }

    logger.info(`Updated extraction profile ${profileId} for API key ${apiKeyId}`);
    return createApiResponse({ profile: updated });
  } catch (error) {
    logger.error('Error updating extraction profile:', error);
    return handleApiError(new Error('Failed to update extraction profile'));
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const { apiKeyId, profileId } = params;
    if (!apiKeyId || !profileId) {
      return createApiError('apiKeyId and profileId are required', 400);
    }

    const existing = getExtractionBackup(apiKeyId);
    if (!existing?.bundle.profiles[profileId]) {
      return createApiResponse({ deleted: false });
    }

    const nextProfiles = { ...existing.bundle.profiles };
    Reflect.deleteProperty(nextProfiles, profileId);
    existing.bundle.profiles = nextProfiles;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveExtractionBackup(apiKeyId, existing.bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to delete extraction profile', 500);
    }

    logger.info(`Deleted extraction profile ${profileId} for API key ${apiKeyId}`);
    return createApiResponse({ deleted: true });
  } catch (error) {
    logger.error('Error deleting extraction profile:', error);
    return handleApiError(new Error('Failed to delete extraction profile'));
  }
};
