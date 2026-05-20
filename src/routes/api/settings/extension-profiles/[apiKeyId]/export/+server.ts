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
import { createApiError } from '$lib/server/api-utils';
import { listApiKeys } from '$lib/server/apikey';
import { getProfileBackup } from '$lib/server/extensionProfileBackupManager';
import { getSubBackup } from '$lib/server/extensionSubBackupManager';
import {
  COMBINED_BUNDLE_KIND,
  COMBINED_BUNDLE_VERSION,
} from '$lib/server/validation/extensionProfiles';

function sanitizeFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unnamed'
  );
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { apiKeyId } = params;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const apiKeys = await listApiKeys();
    const apiKey = apiKeys.find((k) => k.id === apiKeyId);
    if (!apiKey) {
      return createApiError('API key not found', 404);
    }

    const selectorBackup = getProfileBackup(apiKeyId);
    const subBackup = getSubBackup(apiKeyId);

    // Empty profiles on both sides is valid — yields an importable no-op file.
    const selectors = selectorBackup?.bundle ?? { version: 1, profiles: {} };
    const subs = subBackup?.bundle ?? { version: 1, profiles: {} };

    const envelope = {
      kind: COMBINED_BUNDLE_KIND,
      version: COMBINED_BUNDLE_VERSION,
      exportedAt: Date.now(),
      apiKeyName: apiKey.name,
      selectors,
      subs,
    };

    const date = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFilename(apiKey.name);
    const filename = `gdluxx-extension-profiles-${safeName}-${date}.json`;

    return new Response(JSON.stringify(envelope, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Error exporting extension profiles:', error);
    return createApiError('Failed to export extension profiles', 500);
  }
};
