import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import bcrypt from 'bcrypt';
import { logger } from '$lib/shared/logger';
import { PATHS } from '$lib/server/constants';
import type { ApiKey, NewApiKeyResponse } from '$lib/types/apiKey';
import { isValidApiKey } from '$lib/server/apiKeyUtils';

const SALT_ROUNDS = 12;

async function ensureDataDir(): Promise<void> {
  try {
    await mkdir(PATHS.DATA_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create data directory:', PATHS.DATA_DIR, error);
    throw new Error('Failed to ensure data directory exists.');
  }
}

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
    await ensureDataDir();

    try {
      const fileContent = await readFile(PATHS.API_KEYS_FILE, 'utf-8');
      const rawData: unknown = JSON.parse(fileContent);

      if (!Array.isArray(rawData)) {
        logger.warn('API keys file contains invalid data structure, resetting to empty array');
        await writeFile(PATHS.API_KEYS_FILE, JSON.stringify([], null, 2), 'utf-8');
        return json([]);
      }

      if (!rawData.every(isValidApiKey)) {
        logger.warn('API keys file contains invalid API key objects, resetting to empty array');
        await writeFile(PATHS.API_KEYS_FILE, JSON.stringify([], null, 2), 'utf-8');
        return json([]);
      }

      return json(rawData);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        // Create file if it doesn't exist
        logger.info('API keys file not found, creating new file');
        await writeFile(PATHS.API_KEYS_FILE, JSON.stringify([], null, 2), 'utf-8');
        return json([]);
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error loading API keys:', error);
    return json({ error: 'Failed to load API keys' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    await ensureDataDir();

    const body = await request.json();

    // Creating a new key?
    if (body.action === 'create') {
      const { id, name, createdAt } = body;

      if (!id || !name || !createdAt) {
        return json({ error: 'Missing required fields: id, name, createdAt' }, { status: 400 });
      }

      const plainKey: string = generateApiKey();
      const hashedKey: string = await bcrypt.hash(plainKey, SALT_ROUNDS);

      const newApiKey: ApiKey = {
        id,
        name,
        hashedKey,
        createdAt,
      };

      let existingKeys: ApiKey[] = [];
      try {
        const fileContent = await readFile(PATHS.API_KEYS_FILE, 'utf-8');
        const rawData: unknown = JSON.parse(fileContent);
        if (Array.isArray(rawData) && rawData.every(isValidApiKey)) {
          existingKeys = rawData;
        }
      } catch (error) {
        logger.info('Starting with empty API keys array', error);
      }

      existingKeys.push(newApiKey);

      await writeFile(PATHS.API_KEYS_FILE, JSON.stringify(existingKeys, null, 2), 'utf-8');

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
