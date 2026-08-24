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
import { createApiError, createApiResponse } from '$lib/server/api-utils';
import { listApiKeys } from '$lib/server/apikey';
import { importExtensionProfileBundles } from '$lib/server/extensionProfileImport';
import { parseJson } from '$lib/server/validation/zod';
import { importableCombinedBundleSchema } from '$lib/server/validation/extensionProfiles';
import { requireUser } from '$lib/server/auth/requireUser';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const user = requireUser(locals);
  try {
    const { apiKeyId } = params;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const apiKeys = await listApiKeys();
    if (!apiKeys.some((k) => k.id === apiKeyId)) {
      return createApiError('API key not found', 400);
    }

    const parseResult = await parseJson(request, importableCombinedBundleSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const imported = parseResult.data;

    const syncedBy = user.email ?? user.name ?? null;

    // the merge + the three writes are one transaction
    const outcome = importExtensionProfileBundles(apiKeyId, imported, syncedBy);

    if (!outcome.ok) {
      if (outcome.reason === 'validation') {
        return createApiError(outcome.message, 400);
      }

      logger.error(
        `Extension profile import rolled back for API key ${apiKeyId} (stage: ${outcome.stage})`,
      );
      return createApiError('Failed to save imported profiles. No changes were made.', 500);
    }

    return createApiResponse({
      selectors: outcome.selectors,
      subs: outcome.subs,
      extraction: outcome.extraction,
    });
  } catch (error) {
    logger.error('Error importing extension profiles:', error);
    return createApiError('Failed to import extension profiles', 500);
  }
};
