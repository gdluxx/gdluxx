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
  deleteExtractionBackup,
  getExtractionBackup,
  saveExtractionBackup,
  type ExtractionBundle,
  type SavedExtractionProfile,
} from '$lib/server/extensionExtractionBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import {
  extractionProfileCreateSchema,
  extractionProfileSchema,
  MAX_PROFILES_PER_HOST,
  MAX_TOTAL_PROFILES,
  normaliseRuleInputs,
} from '$lib/server/validation/extensionProfiles';
import {
  buildProfileId,
  normaliseHost,
  normaliseOrigin,
  normalisePath,
} from '$lib/extensionProfiles/profileId';

function emptyBundle(): ExtractionBundle {
  return { version: 1, profiles: {} };
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { apiKeyId } = params;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const apiKeys = await listApiKeys();
    if (!apiKeys.some((k) => k.id === apiKeyId)) {
      return createApiError('API key not found', 404);
    }

    const backup = getExtractionBackup(apiKeyId);
    if (!backup) {
      return createApiResponse({
        hasBackup: false,
        profileCount: 0,
        bundle: { version: 1, profiles: {} },
        syncedBy: null,
        updatedAt: null,
      });
    }

    return createApiResponse({
      hasBackup: true,
      profileCount: backup.profileCount,
      bundle: backup.bundle,
      syncedBy: backup.syncedBy,
      updatedAt: backup.updatedAt,
    });
  } catch (error) {
    logger.error('Error loading extraction backup:', error);
    return handleApiError(new Error('Failed to load extraction backup'));
  }
};

// POST creates a single profile inside the stored bundle, while GET/DELETE on
// this same path operate on the whole backup (mirrors the legacy selectors/subs
// collection routes).
export const POST: RequestHandler = async ({ request, params, locals }) => {
  try {
    const apiKeyId = params.apiKeyId;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const parseResult = await parseJson(request, extractionProfileCreateSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const apiKeys = await listApiKeys();
    if (!apiKeys.some((k) => k.id === apiKeyId)) {
      return createApiError('API key not found', 404);
    }

    const host = normaliseHost(input.host);
    const origin = input.scope === 'host' ? undefined : normaliseOrigin(input.origin);
    const path = input.scope === 'path' ? (normalisePath(input.path) ?? '/') : undefined;
    const id = buildProfileId(input.scope, host, origin, path);

    const existing = getExtractionBackup(apiKeyId);
    const bundle = existing?.bundle ?? emptyBundle();

    if (bundle.profiles[id]) {
      return createApiError('A profile with this scope/host/path already exists.', 409);
    }

    const profiles = Object.values(bundle.profiles);
    if (profiles.length >= MAX_TOTAL_PROFILES) {
      return createApiError(
        `Backup already holds the maximum of ${MAX_TOTAL_PROFILES} profiles.`,
        400,
      );
    }
    const hostCount = profiles.filter((p) => p.host === host).length;
    if (hostCount >= MAX_PROFILES_PER_HOST) {
      return createApiError(
        `Host "${host}" already has the maximum of ${MAX_PROFILES_PER_HOST} profiles.`,
        400,
      );
    }

    const now = Date.now();
    const newProfile: SavedExtractionProfile = {
      id,
      scope: input.scope,
      host,
      origin,
      path,
      name: input.name?.trim() || undefined,
      extraction: input.extraction,
      rules: normaliseRuleInputs(input.rules),
      applyToPreview: input.applyToPreview,
      autoApply: input.autoApply,
      gallery: input.gallery,
      createdAt: now,
      updatedAt: now,
    };

    const validation = extractionProfileSchema.safeParse(newProfile);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid profile';
      return createApiError(message, 400);
    }

    bundle.profiles[id] = newProfile;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveExtractionBackup(apiKeyId, bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to save extraction profile', 500);
    }

    logger.info(`Created extraction profile ${id} for API key ${apiKeyId}`);
    return createApiResponse({ profile: newProfile });
  } catch (error) {
    logger.error('Error creating extraction profile:', error);
    return handleApiError(new Error('Failed to create extraction profile'));
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { apiKeyId } = params;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const apiKeys = await listApiKeys();
    if (!apiKeys.some((k) => k.id === apiKeyId)) {
      return createApiError('API key not found', 404);
    }

    const deleted = deleteExtractionBackup(apiKeyId);
    if (deleted) {
      logger.info(`Deleted extraction profile backup for API key ${apiKeyId} via settings.`);
    }

    return createApiResponse({ deleted });
  } catch (error) {
    logger.error('Error deleting extraction backup:', error);
    return handleApiError(new Error('Failed to delete extraction backup'));
  }
};
