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
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from '$lib/shared/logger';
import { ensureDir } from '$lib/utils/fs';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation-utils';
import { configUpdateSchema } from '$lib/server/config-validation';

const DATA_PATH = process.env.FILE_STORAGE_PATH ?? './data';
const CONFIG_FILE = 'config.json';
const EXAMPLE_CONFIG_FILE = './static/config-example.json';


// To accommodate for Docker bind mount pathing, we need to ensure user's config paths are correct
// If not, they'll be prefixed with `/app/data`, some assumptions will be made
function transformConfigPaths(jsonString: string): string {
  try {
    const config = JSON.parse(jsonString);

    // Check if a path needs prefixing
    const needsPrefixing = (value: string): boolean => {
      if (!value) {
        return false;
      }

      // Skip if already using `/app/data`
      if (value.startsWith('/app/data')) {
        return false;
      }

      // Only prefix absolute paths that won't work in the container
      return value.startsWith('/') || value.startsWith('~/') || value.startsWith('./');
    };

    // Prefix paths for container compatibility while preserving user structure
    // We don't want to assume user is OK with the path being reduced to `/app/data`
    const prefixForDocker = (value: string): string => {
      if (!needsPrefixing(value)) {
        return value;
      }

      if (value.startsWith('~/')) {
        // ~/mydownloads/... → /app/data/mydownloads/...
        return `/app/data/${value.substring(2)}`;
      }

      if (value.startsWith('./')) {
        // ./mydownloads/... → /app/data/mydownloads/...
        return `/app/data/${value.substring(2)}`;
      }

      if (value.startsWith('/')) {
        // /home/user/mydownloads/... → /app/data/home/user/mydownloads/...
        return `/app/data${value}`;
      }

      return value;
    };

    // Recursively transform paths in the config object
    const transformObject = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        return prefixForDocker(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map(transformObject);
      }

      if (obj && typeof obj === 'object') {
        const transformed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          // Transform specific known path fields and directory keys
          if (['base-directory', 'archive', 'path', 'part-directory', 'directory'].includes(key)) {
            if (typeof value === 'string') {
              transformed[key] = prefixForDocker(value);
            } else {
              transformed[key] = transformObject(value);
            }
          } else {
            transformed[key] = transformObject(value);
          }
        }
        return transformed;
      }

      return obj;
    };

    const transformedConfig: unknown = transformObject(config);
    return JSON.stringify(transformedConfig, null, 2);
  } catch (error) {
    // If JSON parsing fails, return original content
    logger.warn('Failed to parse JSON for path transformation:', error);
    return jsonString;
  }
}

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const configPath = join(DATA_PATH, CONFIG_FILE);

    try {
      const content: string = await readFile(configPath, 'utf-8');

      // Don't validate JSON here - just return the raw content
      // Otherwise the editor won't show parts of the JSON that are invalid,
      //   yet it will exist in the file
      // The frontend editor will handle validation and show linting errors

      return createApiResponse({
        content,
        source: 'config',
        path: CONFIG_FILE,
      });
    } catch (configError) {
      // If it doesn't exist, load the example config
      if ((configError as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          const exampleContent: string = await readFile(EXAMPLE_CONFIG_FILE, 'utf-8');

          return createApiResponse({
            content: exampleContent,
            source: 'example',
            path: CONFIG_FILE,
            message: 'Loaded example configuration. Save to create your config file.',
          });
        } catch (_exampleError) {
          return handleApiError(new Error('Both config.json and config-example.json are unavailable'));
        }
      } else {
        return handleApiError(new Error(`Failed to read configuration file: ${(configError as Error).message}`));
      }
    }
  } catch (error) {
    logger.error('Error reading config file:', error);
    return handleApiError(error as Error);
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const body = await request.json();
    
    validateInput(body, configUpdateSchema);
    
    const { content } = body;

    const transformedContent: string = transformConfigPaths(content);
    const wasTransformed: boolean = content !== transformedContent;

    const fullPath: string = join(DATA_PATH, CONFIG_FILE);

    await ensureDir(dirname(fullPath));
    await writeFile(fullPath, transformedContent, 'utf-8');

    return createApiResponse({
      message: wasTransformed ? 'Saved successfully (paths transformed)!' : 'Saved successfully!',
      path: CONFIG_FILE,
      transformed: wasTransformed,
      content: wasTransformed ? transformedContent : undefined,
    });
  } catch (error) {
    logger.error('Error saving file:', error);
    return handleApiError(error as Error);
  }
};