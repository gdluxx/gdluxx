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
import { validateApiKey } from '$lib/server/auth/apiAuth';
import { createApiError, createApiResponse } from '$lib/server/api-utils';

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Extension ping attempted without bearer token.');
    return createApiError('Authorization header with Bearer token is required', 401);
  }

  const plainApiKey = authHeader.substring(7).trim();
  if (!plainApiKey) {
    logger.warn('Extension ping received an empty bearer token.');
    return createApiError('Bearer token cannot be empty', 400);
  }

  const authResult = await validateApiKey(plainApiKey);
  if (!authResult.success) {
    logger.warn(`Extension ping rejected: ${authResult.error ?? 'Invalid API key.'}`);
    return createApiError(authResult.error ?? 'Invalid API key.', 401);
  }

  logger.info(
    `Extension ping succeeded for API key ${authResult.keyInfo?.name} (ID: ${authResult.keyInfo?.id}).`,
  );

  return createApiResponse({
    message: 'Connection successful!',
    keyId: authResult.keyInfo?.id,
    keyName: authResult.keyInfo?.name,
  });
};
