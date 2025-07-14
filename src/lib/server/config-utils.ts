/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from '$lib/shared/logger';
import { ensureDir } from '$lib/utils/fs';

export const DATA_PATH = process.env.FILE_STORAGE_PATH ?? './data';
export const CONFIG_FILE = 'config.json';
export const EXAMPLE_CONFIG_FILE = './static/config-example.json';

export interface ConfigReadResult {
  content: string;
  source: 'config' | 'example';
  path: string;
  message?: string;
}

export interface ConfigWriteResult {
  success: boolean;
  message: string;
  path: string;
  transformed: boolean;
  content?: string;
}

interface KeyPathConfig {
  replacementPath: string;
  preserveFilename?: boolean;
  customTransform?: (value: string) => string;
}

const keyConfigs: Record<string, KeyPathConfig> = {
  // Archive keys at any nesting level
  archive: {
    replacementPath: '/app/data/archives',
    preserveFilename: true,
  },

  // Download directory
  'extractor.base-directory': {
    replacementPath: '/app/data/downloads',
    preserveFilename: false,
  },

  // General paths
  path: {
    replacementPath: '/app/data/downloads',
    preserveFilename: false,
  },

  // Part directories
  'part-directory': {
    replacementPath: '/app/data/temp',
    preserveFilename: false,
  },

  // Cookie files
  'extractor.cookies.path': {
    replacementPath: '/app/data/cookies',
    preserveFilename: true,
  },
  'extractor.cookies-update.path': {
    replacementPath: '/app/data/cookies',
    preserveFilename: true,
  },

  // Binary files
  'extractor.ytdl.module': {
    replacementPath: '/app/data/bin',
    preserveFilename: true,
  },
  'downloader.ytdl.module': {
    replacementPath: '/app/data/bin',
    preserveFilename: true,
  },

  // Log files
  'output.logfile.path': {
    replacementPath: '/app/data/logs',
    preserveFilename: true,
  },
  'output.unsupportedfile.path': {
    replacementPath: '/app/data/logs',
    preserveFilename: true,
  },
  'output.errorfile.path': {
    replacementPath: '/app/data/logs',
    preserveFilename: true,
  },

  // Metadata
  'metadata.base-directory': {
    replacementPath: '/app/data/metadata',
    preserveFilename: false,
  },
};

// Replace config paths for Docker container compatibility.
// Replaces paths with /app/data based paths since we're working with docker bind mounts
// First, identify what needs needs transformed
export function transformConfigPaths(jsonString: string): string {
  try {
    const config = JSON.parse(jsonString);

    // Does path need modified?
    const needsTransformation = (value: string): boolean => {
      if (!value) {
        return false;
      }

      // Skip if already using `/app/data`
      // Work around for user to manipulate the paths, but still forces everything outside the container
      if (value.startsWith('/app/data')) {
        return false;
      }

      // Only prefix paths that won't work in the container
      return value.startsWith('/') || value.startsWith('~/') || value.startsWith('./');
    };

    // Helper to build full key path
    const buildKeyPath = (keyPath: string[]): string => {
      return keyPath.join('.');
    };

    // wildcard support to match key patterns
    const matchesPattern = (keyPath: string, pattern: string): boolean => {
      if (pattern === keyPath) {
        return true;
      }

      // Convert pattern to regex, very simple wildcards (possible future use)
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*');

      return new RegExp(`^${regexPattern}$`).test(keyPath);
    };

    const findMatchingConfig = (keyPath: string[], currentKey: string): KeyPathConfig | null => {
      const fullPath = buildKeyPath(keyPath);

      // try exact match
      if (keyConfigs[fullPath]) {
        return keyConfigs[fullPath];
      }

      // Try pattern matching with wildcards (prioritize longer patterns)
      const matchingConfigs = Object.entries(keyConfigs).filter(([configKey]) =>
        matchesPattern(fullPath, configKey)
      );

      if (matchingConfigs.length > 0) {
        // Sort by pattern length (longer patterns = more specific)
        const sortedMatches = matchingConfigs.sort(([a], [b]) => b.length - a.length);
        return sortedMatches[0][1];
      }

      // if any part of the path contains 'archive', they'll get dumped to /app/data/archives
      if (keyPath.some(part => part === 'archive') || currentKey === 'archive') {
        return keyConfigs.archive;
      }

      // And then try current key alone (least specific)
      if (keyConfigs[currentKey]) {
        return keyConfigs[currentKey];
      }

      return null;
    };

    // Now we're replacing
    const replacePathForDocker = (value: string, config: KeyPathConfig | null): string => {
      if (!needsTransformation(value)) {
        return value;
      }

      if (config?.customTransform) {
        return config.customTransform(value);
      }

      const replacementPath = config?.replacementPath || '/app/data';
      const preserveFilename = config?.preserveFilename ?? false;

      if (preserveFilename) {
        // Extract filename from the original path
        const filename = value.split('/').pop() || '';
        return filename ? `${replacementPath}/${filename}` : replacementPath;
      } else {
        // Use the replacement path as-is (for directories)
        return replacementPath;
      }
    };

    // Recursively replace paths in the config object
    const transformObject = (obj: unknown, keyPath: string[] = []): unknown => {
      if (typeof obj === 'string') {
        const currentKey = keyPath[keyPath.length - 1];
        const config: KeyPathConfig | null = findMatchingConfig(keyPath, currentKey);
        return replacePathForDocker(obj, config);
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) => transformObject(item, [...keyPath, index.toString()]));
      }

      if (obj && typeof obj === 'object') {
        const transformed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          const newKeyPath = [...keyPath, key];
          transformed[key] = transformObject(value, newKeyPath);
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

// Read configuration file, falling back to example if not found.
export async function readConfigFile(): Promise<ConfigReadResult> {
  const configPath = join(DATA_PATH, CONFIG_FILE);

  try {
    const content: string = await readFile(configPath, 'utf-8');

    // Don't validate JSON here - just return the raw content
    // Otherwise the editor won't show parts of the JSON that are invalid,
    //   yet it will exist in the file
    // The frontend editor will handle validation and show linting errors

    return {
      content,
      source: 'config',
      path: CONFIG_FILE,
    };
  } catch (configError) {
    // If it doesn't exist, load the example config
    if ((configError as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        const exampleContent: string = await readFile(EXAMPLE_CONFIG_FILE, 'utf-8');

        return {
          content: exampleContent,
          source: 'example',
          path: CONFIG_FILE,
          message: 'Loaded example configuration. Save to create your config file.',
        };
      } catch (_exampleError) {
        throw new Error('Both config.json and config-example.json are unavailable');
      }
    } else {
      throw new Error(`Failed to read configuration file: ${(configError as Error).message}`);
    }
  }
}

// Write configuration file with path transformation.
export async function writeConfigFile(content: string): Promise<ConfigWriteResult> {
  if (!content) {
    throw new Error('Content cannot be empty');
  }

  const transformedContent: string = transformConfigPaths(content);
  const wasTransformed: boolean = content !== transformedContent;

  const fullPath: string = join(DATA_PATH, CONFIG_FILE);

  await ensureDir(dirname(fullPath));
  await writeFile(fullPath, transformedContent, 'utf-8');

  return {
    success: true,
    message: wasTransformed ? 'Saved successfully (paths transformed)!' : 'Saved successfully!',
    path: CONFIG_FILE,
    transformed: wasTransformed,
    content: wasTransformed ? transformedContent : undefined,
  };
}
