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
import type { Actions } from './$types';
import { logger } from '$lib/shared/logger';
import { createPageLoad } from '$lib/utils/page-load';
import {
  createApiKey,
  findApiKeyByName,
  deleteApiKey,
  API_KEY_VALIDATION,
  validateApiKeyName,
  validateExpirationDate,
  type ApiKey,
  type NewApiKeyResponse,
} from './lib/server-exports';

const getClientSafeMessage = (error: Error) => {
  if (dev) {
    return error.message;
  }

  if (error.name === 'ValidationError') {
    return 'Invalid input provided.';
  }
  if (error.name === 'NotFoundError') {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
};

export const load = createPageLoad({
  endpoint: '/settings/apikey',
  fallback: { apiKeys: [] },
  errorMessage: 'Failed to load API keys',
});

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

      const nameError: string | null = validateApiKeyName(name);
      if (nameError) {
        return fail(400, {
          error: nameError,
          success: false,
        });
      }

      const trimmedName: string = name.trim();
      const existingKey: ApiKey | null = await findApiKeyByName(trimmedName);
      if (existingKey) {
        return fail(400, {
          error: API_KEY_VALIDATION.NAME.DUPLICATE_MESSAGE,
          success: false,
        });
      }

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
