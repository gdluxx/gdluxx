/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// node:fs/promises, not node:fs: tests/command-launcher.test.ts replaces the
// whole node:fs module with a two-property stub with no `promises` export.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from '$lib/server/constants';
import { serverLogger as logger } from '$lib/server/logger';
import {
  ConfigExecutionBlockedError,
  ExecPolicyError,
  assertConfigObjectAllowed,
  parseConfigText,
  CLIENT_MESSAGE_EXECUTION_BLOCKED,
  type PolicyViolation,
} from '$lib/server/validation/exec-policy';

type CachedVerdict = { allowed: true } | { allowed: false; violations: readonly PolicyViolation[] };

interface CacheEntry {
  key: string;
  verdict: CachedVerdict;
}

// Cache only the parse/policy verdict; stat every call so external edits
// invalidate the entry.
let cache: CacheEntry | null = null;

function blocked(violations: readonly PolicyViolation[]): never {
  throw new ConfigExecutionBlockedError(
    CLIENT_MESSAGE_EXECUTION_BLOCKED,
    CLIENT_MESSAGE_EXECUTION_BLOCKED,
    violations,
  );
}

export async function assertConfigFileSafeForExecution(
  configPath: string = PATHS.CONFIG_FILE,
): Promise<void> {
  const resolvedPath = path.resolve(configPath);

  let mtimeMs: number;
  let size: number;
  try {
    const stats = await stat(resolvedPath);
    mtimeMs = stats.mtimeMs;
    size = stats.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    logger.error('Failed to stat gallery-dl config for execution guard:', error);
    blocked([]);
  }

  const cacheKey = `${resolvedPath}:${mtimeMs}:${size}`;
  if (cache?.key === cacheKey) {
    if (!cache.verdict.allowed) {
      blocked(cache.verdict.violations);
    }
    return;
  }

  let content: string;
  try {
    content = await readFile(resolvedPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Raced with a delete between stat and read; treat as absent.
      return;
    }
    logger.error('Failed to read gallery-dl config for execution guard:', error);
    blocked([]);
  }

  try {
    assertConfigObjectAllowed(parseConfigText(content));
  } catch (error) {
    if (error instanceof ExecPolicyError) {
      logger.error(
        'Refusing gallery-dl execution: the saved config contains a prohibited setting.',
        error.violations,
      );
      cache = { key: cacheKey, verdict: { allowed: false, violations: error.violations } };
      blocked(error.violations);
    }
    throw error;
  }

  cache = { key: cacheKey, verdict: { allowed: true } };
}

export function resetConfigGuardCache(): void {
  cache = null;
}
