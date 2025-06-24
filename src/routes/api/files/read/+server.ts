import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '$lib/shared/logger';

const DATA_PATH = process.env.FILE_STORAGE_PATH ?? './data';
const CONFIG_FILE = 'config.json';
const EXAMPLE_CONFIG_FILE = './static/config-example.json';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const configPath = join(DATA_PATH, CONFIG_FILE);

    try {
      const content: string = await readFile(configPath, 'utf-8');

      // Don't validate JSON here - just return the raw content
      // Otherwise the editor won't show parts of the JSON that are invalid,
      //   yet it will exist in the file
      // The frontend editor will handle validation and show linting errors

      return json({
        success: true,
        content,
        source: 'config',
        path: CONFIG_FILE,
      });
    } catch (configError) {
      // If it doesn't exist, load the example config
      if ((configError as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          const exampleContent: string = await readFile(EXAMPLE_CONFIG_FILE, 'utf-8');

          return json({
            success: true,
            content: exampleContent,
            source: 'example',
            path: CONFIG_FILE,
            message: 'Loaded example configuration. Save to create your config file.',
          });
        } catch (exampleError) {
          return json(
            {
              error: 'Failed to load configuration',
              details: 'Both config.json and config-example.json are unavailable',
              errorMessage:
                exampleError instanceof Error ? exampleError.message : String(exampleError),
            },
            { status: 500 }
          );
        }
      } else {
        return json(
          {
            error: 'Failed to read configuration file',
            details: (configError as Error).message,
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    logger.error('Error reading config file:', error);
    return json(
      {
        error: 'Failed to read configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
