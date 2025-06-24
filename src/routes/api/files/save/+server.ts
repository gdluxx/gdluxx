import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from '$lib/shared/logger';

const ALLOWED_BASE_PATH: string = process.env.FILE_STORAGE_PATH || './data';
const CONFIG_FILE = 'config.json';

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  try {
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return json({ error: 'Invalid content - must be string' }, { status: 400 });
    }

    if (!content) {
      return json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    // Note: We intentionally do NOT validate JSON here because users should be
    // able to save invalid JSON if they explicitly choose to do so via the confirmation modal

    const fullPath: string = join(ALLOWED_BASE_PATH, CONFIG_FILE);

    // TODO: add check if directory exists
    try {
      await mkdir(dirname(fullPath), { recursive: true });
    } catch (dirError) {
      logger.error('Error creating directory:', dirError);
    }

    await writeFile(fullPath, content, 'utf-8');

    return json({
      success: true,
      message: 'Configuration saved successfully',
      path: CONFIG_FILE,
    });
  } catch (error) {
    logger.error('Error saving file:', error);
    return json(
      {
        error: 'Failed to save file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
