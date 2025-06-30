/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import bcrypt from 'bcrypt';
import { logger } from '$lib/shared/logger';
import type { ApiKey } from '$lib/types/apiKey';
import type { RequestEvent } from '@sveltejs/kit';
import { readApiKeys } from './apiKeyManager';

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

    // Load keys from database
    const apiKeys: ApiKey[] = await readApiKeys();

    if (apiKeys.length === 0) {
      return { success: false, error: 'No API keys configured' };
    }

    // Check the provided key against hashed keys
    for (const storedKey of apiKeys) {
      const isMatch = await bcrypt.compare(providedKey, storedKey.hashedKey);
      if (isMatch) {
        logger.info(`Valid API key used: ${storedKey.name} (${storedKey.id})`);
        return {
          success: true,
          keyInfo: {
            id: storedKey.id,
            name: storedKey.name,
            createdAt: storedKey.createdAt,
          },
        };
      }
    }

    // No match found
    logger.warn('Invalid API key attempt');
    return { success: false, error: 'Invalid API key' };
  } catch (error) {
    logger.error('Error validating API key:', error);
    return { success: false, error: 'Validation failed' };
  }
}

export function extractApiKey(request: Request): string | null {
  // Try Authorization header first (Bearer token format)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove "Bearer " prefix
  }

  // Try X-API-Key header next
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

export async function requireApiKey(event: RequestEvent): Promise<AuthResult> {
  const apiKey: string | null = extractApiKey(event.request);

  if (!apiKey) {
    return {
      success: false,
      error:
        'API key required. Provide it via Authorization header (Bearer token) or X-API-Key header.',
    };
  }

  return await validateApiKey(apiKey);
}

export function unauthorizedResponse(message?: string) {
  return new Response(
    JSON.stringify({
      error: message || 'Unauthorized. Valid API key required.',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
