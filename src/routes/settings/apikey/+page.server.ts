/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad, Actions } from './$types';
import { logger } from '$lib/shared/logger';
import type { ApiKey, NewApiKeyResponse } from '$lib/types/apiKey';
import {
  createApiKey,
  listApiKeys,
  findApiKeyByName,
  deleteApiKey,
} from '$lib/server/apiKeyManager';
import {
  API_KEY_VALIDATION,
  validateApiKeyName,
  validateExpirationDate,
} from '$lib/shared/apiKeyValidation';

const getClientSafeMessage = (error: Error) => {
  if (dev) {
    return error.message;
  }

  // Categorize errors for better UX while remaining secure
  if (error.name === 'ValidationError') {
    return 'Invalid input provided.';
  }
  if (error.name === 'NotFoundError') {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
};

export const load: PageServerLoad = async () => {
  try {
    const apiKeys: ApiKey[] = await listApiKeys();
    return {
      success: true,
      apiKeys,
    };
  } catch (error) {
    logger.error('Error loading API keys:', error);
    return {
      success: false,
      apiKeys: [],
      error: 'Failed to load API keys',
    };
  }
};

export const actions: Actions = {
  create: async ({ request }) => {
    try {
      const formData = await request.formData();
      const name = formData.get('name') as string;
      const expiresAt = formData.get('expiresAt') as string;
      const neverExpires = formData.get('neverExpires') === 'true';

      if (!name?.trim()) {
        return fail(400, {
          error: API_KEY_VALIDATION.NAME.REQUIRED_MESSAGE,
          success: false,
        });
      }

      // Validate API key name using shared validation
      const nameError: string | null = validateApiKeyName(name);
      if (nameError) {
        return fail(400, {
          error: nameError,
          success: false,
        });
      }

      // Check for duplicate name
      const trimmedName: string = name.trim();
      const existingKey: ApiKey | null = await findApiKeyByName(trimmedName);
      if (existingKey) {
        return fail(400, {
          error: API_KEY_VALIDATION.NAME.DUPLICATE_MESSAGE,
          success: false,
        });
      }

      // Validate expiration date if provided
      const expirationDate = !neverExpires && expiresAt ? expiresAt : undefined;
      if (expirationDate) {
        const expirationError: string | null = validateExpirationDate(expirationDate);
        if (expirationError) {
          return fail(400, {
            error: expirationError,
            success: false,
          });
        }
      }

      const expiresAtDate: Date | undefined = expirationDate ? new Date(expirationDate) : undefined;
      const result = await createApiKey(trimmedName, expiresAtDate);

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

      return {
        success: true,
        apiKey: response.apiKey,
        plainKey: response.plainKey,
      };
    } catch (error) {
      logger.error('Error creating API key:', error);
      return fail(500, {
        error: getClientSafeMessage(error as Error),
        success: false,
      });
    }
  },

  delete: async ({ request }) => {
    try {
      const formData = await request.formData();
      const keyId = formData.get('keyId') as string;

      if (!keyId) {
        return fail(400, {
          error: 'API key ID is required',
          success: false,
        });
      }

      await deleteApiKey(keyId);

      return {
        success: true,
        message: 'API key deleted successfully',
        deletedKeyId: keyId,
      };
    } catch (error) {
      logger.error('Error deleting API key:', error);
      return fail(500, {
        error: getClientSafeMessage(error as Error),
        success: false,
      });
    }
  },
};
