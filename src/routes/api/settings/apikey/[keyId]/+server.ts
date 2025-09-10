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
import { deleteApiKey } from '$lib/server/apikey/apiKeyManager';
import { createApiError, createApiResponse } from '$lib/server/api-utils';

export const DELETE: RequestHandler = async ({ params }): Promise<Response> => {
  try {
    const { keyId } = params;

    if (!keyId) {
      return createApiError('API key ID is required', 400);
    }

    await deleteApiKey(keyId);

    return createApiResponse({
      message: 'API key deleted successfully',
      deletedKeyId: keyId,
    });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    return createApiError('Failed to delete API key', 500);
  }
};
