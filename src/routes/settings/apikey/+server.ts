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
import { logger } from '$lib/shared/logger';
import {
  createApiKey,
  listApiKeys,
  findApiKeyByName,
  API_KEY_VALIDATION,
  validateApiKeyName,
  validateExpirationDate,
  type ApiKey,
  type CreateApiKeyRequest,
  type NewApiKeyResponse,
  createApiKeySchema,
} from './lib/server-exports';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const apiKeys: ApiKey[] = await listApiKeys();
    return createApiResponse({ apiKeys });
  } catch (error) {
    logger.error('Error loading API keys:', error);
    return handleApiError(new Error(API_KEY_VALIDATION.SERVER.LOAD_FAILED));
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const body: CreateApiKeyRequest = await request.json();

    validateInput(body as unknown as Record<string, unknown>, createApiKeySchema);

    const nameError: string | null = validateApiKeyName(body.name || '');
    if (nameError) {
      return handleApiError(new Error(nameError));
    }

    const trimmedName: string = body.name.trim();
    const existingKey: ApiKey | null = await findApiKeyByName(trimmedName);
    if (existingKey) {
      return handleApiError(new Error(API_KEY_VALIDATION.NAME.DUPLICATE_MESSAGE));
    }

    if (body.expiresAt) {
      const expirationError: string | null = validateExpirationDate(body.expiresAt);
      if (expirationError) {
        return handleApiError(new Error(expirationError));
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

    return createApiResponse(response);
  } catch (error) {
    logger.error('Error creating API key:', error);
    return handleApiError(new Error(API_KEY_VALIDATION.SERVER.CREATION_FAILED));
  }
};
