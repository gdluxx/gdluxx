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
import { logger } from '$lib/shared/logger';
import { deleteApiKey } from '../lib/apiKeyManager';

export const DELETE: RequestHandler = async ({ params }): Promise<Response> => {
  try {
    const { keyId } = params;

    if (!keyId) {
      return json({ error: 'API key ID is required' }, { status: 400 });
    }

    await deleteApiKey(keyId);

    return json({
      message: 'API key deleted successfully',
      deletedKeyId: keyId,
    });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    return json({ error: 'Failed to delete API key' }, { status: 500 });
  }
};
