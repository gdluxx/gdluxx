/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { listApiKeys } from '$lib/server/apikey';
import {
  getProfileBackup,
  saveProfileBackup,
  type SelectorProfileBundle,
} from '$lib/server/extensionProfileBackupManager';
import {
  getSubBackup,
  saveSubBackup,
  type SubProfileBundle,
} from '$lib/server/extensionSubBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import {
  combinedBundleSchema,
  selectorBundleSchema,
  subBundleSchema,
} from '$lib/server/validation/extensionProfiles';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  try {
    const { apiKeyId } = params;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const apiKeys = await listApiKeys();
    if (!apiKeys.some((k) => k.id === apiKeyId)) {
      return createApiError('API key not found', 400);
    }

    const parseResult = await parseJson(request, combinedBundleSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const imported = parseResult.data;

    const existingSelectors = getProfileBackup(apiKeyId);
    const existingSubs = getSubBackup(apiKeyId);

    const existingSelectorBundle: SelectorProfileBundle = existingSelectors?.bundle ?? {
      version: 1,
      profiles: {},
    };
    const existingSubBundle: SubProfileBundle = existingSubs?.bundle ?? {
      version: 1,
      profiles: {},
    };

    const mergedSelectors: SelectorProfileBundle = {
      version: existingSelectorBundle.version,
      profiles: { ...existingSelectorBundle.profiles, ...imported.selectors.profiles },
    };
    const mergedSubs: SubProfileBundle = {
      version: existingSubBundle.version,
      profiles: { ...existingSubBundle.profiles, ...imported.subs.profiles },
    };

    // Re-validate merged bundles — an imported bundle may be valid in isolation but exceed caps
    // once overlaid onto a large existing bundle (e.g. 9,990 existing + 20 imported).
    const selValidation = selectorBundleSchema.safeParse(mergedSelectors);
    const subValidation = subBundleSchema.safeParse(mergedSubs);
    if (!selValidation.success || !subValidation.success) {
      const issues = [
        ...(selValidation.success ? [] : selValidation.error.issues),
        ...(subValidation.success ? [] : subValidation.error.issues),
      ];
      const message = issues
        .map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
        .join('\n');
      return createApiError(message, 400);
    }

    const existingSelIds = new Set(Object.keys(existingSelectorBundle.profiles));
    const existingSubIds = new Set(Object.keys(existingSubBundle.profiles));

    const selAdded = Object.keys(imported.selectors.profiles).filter(
      (id) => !existingSelIds.has(id),
    ).length;
    const selUpdated = Object.keys(imported.selectors.profiles).filter((id) =>
      existingSelIds.has(id),
    ).length;
    const subAdded = Object.keys(imported.subs.profiles).filter(
      (id) => !existingSubIds.has(id),
    ).length;
    const subUpdated = Object.keys(imported.subs.profiles).filter((id) =>
      existingSubIds.has(id),
    ).length;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;

    const savedSelectors = saveProfileBackup(apiKeyId, selValidation.data, syncedBy);
    if (!savedSelectors) {
      return createApiError('Failed to save selector profiles', 500);
    }

    const savedSubs = saveSubBackup(apiKeyId, subValidation.data, syncedBy);
    if (!savedSubs) {
      // TODO: atomicity — selector backup was saved but sub backup failed; a full solution
      // would require a shared transaction across both managers.
      logger.error(`Partial import failure for API key ${apiKeyId}: selectors saved, subs failed`);
      return json(
        {
          success: false,
          error: 'Partial import: selector profiles saved, substitution profiles failed.',
          partial: 'selectors-only',
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    return createApiResponse({
      selectors: {
        added: selAdded,
        updated: selUpdated,
        total: Object.keys(mergedSelectors.profiles).length,
      },
      subs: {
        added: subAdded,
        updated: subUpdated,
        total: Object.keys(mergedSubs.profiles).length,
      },
    });
  } catch (error) {
    logger.error('Error importing extension profiles:', error);
    return createApiError('Failed to import extension profiles', 500);
  }
};
