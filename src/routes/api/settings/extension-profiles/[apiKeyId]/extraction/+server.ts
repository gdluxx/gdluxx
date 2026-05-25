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
} from '$lib/server/extensionExtractionBackupManager';

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
