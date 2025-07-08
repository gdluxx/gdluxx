/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { auth } from './better-auth';
import { logger } from '$lib/shared/logger';

export interface AuthResult {
  success: boolean;
  keyInfo?: {
    id: string;
    name: string;
    createdAt: string;
  };
  error?: string;
}

export async function validateApiKey(providedKey: unknown): Promise<AuthResult> {
  try {
    if (!providedKey || typeof providedKey !== 'string') {
      return { success: false, error: 'API key is required' };
    }

    const result = await auth.api.verifyApiKey({
      body: { key: providedKey },
    });

    if (result.valid && result.key) {
      logger.info(`Valid API key used: ${result.key.name || 'Unknown'} (${result.key.id})`);
      return {
        success: true,
        keyInfo: {
          id: result.key.id,
          name: result.key.name || 'Unknown',
          createdAt: new Date(result.key.createdAt).toISOString(),
        },
      };
    }

    logger.warn('Invalid API key attempt');
    return { success: false, error: 'Invalid API key' };
  } catch (error) {
    logger.error('Error validating API key:', error);
    return { success: false, error: 'Validation failed' };
  }
}
