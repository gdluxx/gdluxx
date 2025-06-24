import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import { PATHS } from '$lib/server/constants';
import { logger, type LoggingConfig } from '$lib/shared/logger';

const LOGGING_CONFIG_PATH: string = path.join(PATHS.DATA_DIR, 'logging.json');

const DEFAULT_LOGGING_CONFIG_API: LoggingConfig = {
  enabled: process.env.NODE_ENV === 'development',
  level: 'INFO',
};

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    logger.info('[API TRACE] GET /api/logging/settings invoked.');

    await logger.reloadConfig();
    const config = logger.getConfig();

    logger.info(`[API TRACE] Config to be returned by API to client: ${JSON.stringify(config)}`);

    return json(config);
  } catch (e) {
    logger.error('[API LoggingSettings GET] Error:', e);
    return json({ error: 'Failed to retrieve logging settings' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  try {
    const body = (await request.json()) as Partial<LoggingConfig>;

    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'Invalid payload: "enabled" must be a boolean.' }, { status: 400 });
    }

    let currentPersistedConfig: LoggingConfig;
    try {
      await fs.mkdir(PATHS.DATA_DIR, { recursive: true });
      const fileContent: string = await fs.readFile(LOGGING_CONFIG_PATH, 'utf-8');
      currentPersistedConfig = JSON.parse(fileContent);
    } catch (readError) {
      logger.error('Error reading logging config file:', readError);
      // If file doesn't exist, start from default
      currentPersistedConfig = { ...DEFAULT_LOGGING_CONFIG_API };
    }

    const newConfig: LoggingConfig = {
      ...currentPersistedConfig,
      enabled: body.enabled,

      ...(body.level && { level: body.level }),
    };

    await fs.writeFile(LOGGING_CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    await logger.setConfig(newConfig);

    return json(newConfig);
  } catch (e) {
    logger.error('[API LoggingSettings POST] Error:', e);
    return json({ error: 'Failed to update logging settings' }, { status: 500 });
  }
};
