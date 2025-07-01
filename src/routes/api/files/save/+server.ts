/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from '$lib/shared/logger';
import { ensureDir } from '$lib/utils/fs';

const ALLOWED_BASE_PATH: string = process.env.FILE_STORAGE_PATH || './data';
const CONFIG_FILE = 'config.json';

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

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  try {
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return json({ error: 'Invalid content - must be string' }, { status: 400 });
    }

    if (!content) {
      return json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    const transformedContent: string = transformConfigPaths(content);

    const fullPath: string = join(ALLOWED_BASE_PATH, CONFIG_FILE);

    await ensureDir(dirname(fullPath));
    await writeFile(fullPath, transformedContent, 'utf-8');

    return json({
      success: true,
      message: 'Configuration saved successfully (paths transformed for Docker)',
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
