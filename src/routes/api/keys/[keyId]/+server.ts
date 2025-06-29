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
import { readFile, writeFile } from 'fs/promises';
import { logger } from '$lib/shared/logger';
import { PATHS } from '$lib/server/constants';
import type { ApiKey } from '$lib/types/apiKey';
import { isValidApiKey } from '$lib/server/apiKeyUtils';

export const DELETE: RequestHandler = async ({ params }): Promise<Response> => {
  try {
    const { keyId } = params;

    if (!keyId) {
      return json({ error: 'Key ID is required' }, { status: 400 });
    }

    let existingKeys: ApiKey[] = [];
    try {
      const fileContent = await readFile(PATHS.API_KEYS_FILE, 'utf-8');
      const rawData: unknown = JSON.parse(fileContent);

      if (!Array.isArray(rawData) || !rawData.every(isValidApiKey)) {
        logger.warn('Invalid API keys file structure during deletion');
        return json({ error: 'Invalid keys database' }, { status: 500 });
      }

      existingKeys = rawData;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        return json({ error: 'No API keys found' }, { status: 404 });
      }
      throw error;
    }

    // Find and remove the key
    const keyIndex = existingKeys.findIndex(key => key.id === keyId);

    if (keyIndex === -1) {
      return json({ error: 'API key not found' }, { status: 404 });
    }

    const deletedKey = existingKeys[keyIndex];
    const updatedKeys = existingKeys.filter(key => key.id !== keyId);

    // Save updated keys
    await writeFile(PATHS.API_KEYS_FILE, JSON.stringify(updatedKeys, null, 2), 'utf-8');

    logger.info(`Deleted API key: ${deletedKey.name} (${deletedKey.id})`);

    return json({
      success: true,
      message: `API key "${deletedKey.name}" deleted successfully`,
      deletedKeyId: keyId,
    });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    return json({ error: 'Failed to delete API key' }, { status: 500 });
  }
};
