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
import bcrypt from 'bcrypt';
import { logger } from '$lib/shared/logger';
import type { ApiKey, NewApiKeyResponse } from '$lib/types/apiKey';
import { readApiKeys } from '$lib/server/apiKeyManager';

const SALT_ROUNDS = 12;

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sk-';
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const apiKeys = await readApiKeys();
    return json(apiKeys);
  } catch (error) {
    logger.error('Error loading API keys:', error);
    return json({ error: 'Failed to load API keys' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const body = await request.json();

    // Creating a new key?
    if (body.action === 'create') {
      const { id, name, createdAt } = body;

      if (!id || !name || !createdAt) {
        return json({ error: 'Missing required fields: id, name, createdAt' }, { status: 400 });
      }

      // Check if a key with this name already exists
      const existingKey = await findApiKeyByName(name);
      if (existingKey) {
        return json({ error: 'An API key with this name already exists' }, { status: 400 });
      }

      const plainKey: string = generateApiKey();
      const hashedKey: string = await bcrypt.hash(plainKey, SALT_ROUNDS);

      const newApiKey: ApiKey = {
        id,
        name,
        hashedKey,
        createdAt,
      };

      await createApiKey(newApiKey);

      logger.info(`Created new API key: ${name} (${id})`);

      // Return both the stored key info and the plain key
      const response: NewApiKeyResponse = {
        apiKey: newApiKey,
        plainKey,
      };

      return json(response);
    }

    // else
    else {
      return json(
        { error: 'Invalid action. Use action: "create" to create a new API key' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Error handling API keys request:', error);
    return json({ error: 'Failed to process API keys request' }, { status: 500 });
  }
};
