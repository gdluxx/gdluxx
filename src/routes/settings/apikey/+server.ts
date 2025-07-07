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
import type { ApiKey, CreateApiKeyRequest, NewApiKeyResponse } from '$lib/types/apiKey';
import { createApiKey, listApiKeys, findApiKeyByName } from '$lib/server/apiKeyManager';
import {
  API_KEY_VALIDATION,
  validateApiKeyName,
  validateExpirationDate,
} from '$lib/shared/apiKeyValidation';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const apiKeys: ApiKey[] = await listApiKeys();
    return json(apiKeys);
  } catch (error) {
    logger.error('Error loading API keys:', error);
    return json({ error: API_KEY_VALIDATION.SERVER.LOAD_FAILED }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const body: CreateApiKeyRequest = await request.json();

    // Validate API key name using shared validation
    const nameError: string | null = validateApiKeyName(body.name || '');
    if (nameError) {
      return json({ error: nameError }, { status: 400 });
    }

    // Check for duplicate name
    const trimmedName: string = body.name.trim();
    const existingKey: ApiKey | null = await findApiKeyByName(trimmedName);
    if (existingKey) {
      return json({ error: API_KEY_VALIDATION.NAME.DUPLICATE_MESSAGE }, { status: 400 });
    }

    // Validate expiration date if provided
    if (body.expiresAt) {
      const expirationError: string | null = validateExpirationDate(body.expiresAt);
      if (expirationError) {
        return json({ error: expirationError }, { status: 400 });
      }
    }

    const expiresAt: Date | undefined = body.expiresAt ? new Date(body.expiresAt) : undefined;
    const result = await createApiKey(trimmedName, expiresAt);

    const response: NewApiKeyResponse = {
      apiKey: {
        id: result.id,
        name: result.name,
        userId: result.userId,
        createdAt: new Date(result.createdAt).toISOString(),
        expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
      },
      plainKey: result.key,
    };

    return json(response);
  } catch (error) {
    logger.error('Error creating API key:', error);
    return json({ error: API_KEY_VALIDATION.SERVER.CREATION_FAILED }, { status: 500 });
  }
};