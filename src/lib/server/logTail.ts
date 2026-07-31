/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { constants } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { serverLogger as logger, sanitizeMessage } from './logger';
import {
  LOG_FILE_PATTERN,
  validateLogDirectory,
  type LogTailReason,
  type LogTailResult,
  type ServerLoggingConfig,
} from '$lib/logging';

// Read at most the last quarter-megabyte
const MAX_READ_BYTES = 256 * 1024;
const MAX_LINES = 200;
const MAX_LINE_LENGTH = 2000;

export interface LogFileEntry {
  name: string;
  mtimeMs: number;
}

/*
 * Pure helpers -- no fs, no logger, no config. Everything they need is
 * injected, to keep them directly unit-testable.
 */

export function selectNewestLogFile(entries: LogFileEntry[]): string | null {
  let best: LogFileEntry | null = null;

  for (const entry of entries) {
    if (
      best === null ||
      entry.mtimeMs > best.mtimeMs ||
      (entry.mtimeMs === best.mtimeMs && entry.name > best.name)
    ) {
      best = entry;
    }
  }

  return best?.name ?? null;
}

export function extractTailLines(text: string, maxLines: number, hadOffset: boolean): string[] {
  const lines = text.split(/\r?\n/);

  if (hadOffset) {
    lines.shift();
  }

  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (maxLines <= 0) {
    return [];
  }

  return lines.slice(-maxLines);
}

function unavailable(reason: LogTailReason, loggingEnabled: boolean): LogTailResult {
  return {
    available: false,
    reason,
    loggingEnabled,
    file: null,
    modifiedAt: null,
    sizeBytes: 0,
    lineCount: 0,
    truncated: false,
    lines: [],
  };
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

async function chooseLogFile(root: string): Promise<string | null> {
  const dirents = await readdir(root, { withFileTypes: true });
  const entries: LogFileEntry[] = [];

  for (const dirent of dirents) {
    if (!dirent.isFile() || !LOG_FILE_PATTERN.test(dirent.name)) {
      continue;
    }

    try {
      const stats = await stat(join(root, dirent.name));
      entries.push({ name: dirent.name, mtimeMs: stats.mtimeMs });
    } catch {
      // Raced with rotation/cleanup
    }
  }

  return selectNewestLogFile(entries);
}

export async function readLogTail(config: ServerLoggingConfig): Promise<LogTailResult> {
  const loggingEnabled = config.enabled;

  if (!config.fileEnabled) {
    return unavailable('file-logging-disabled', loggingEnabled);
  }

  const directoryError = validateLogDirectory(config.fileDirectory, true);
  if (directoryError) {
    return unavailable('invalid-directory', loggingEnabled);
  }

  let root: string;
  try {
    root = await realpath(resolve(config.fileDirectory));
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return unavailable('directory-missing', loggingEnabled);
    }
    logger.warn('Log tail could not resolve the log directory:', error);
    return unavailable('unreadable', loggingEnabled);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let name: string | null;
    try {
      name = await chooseLogFile(root);
    } catch (error) {
      logger.warn('Log tail could not list the log directory:', error);
      return unavailable('unreadable', loggingEnabled);
    }

    if (name === null) {
      return unavailable('no-log-files', loggingEnabled);
    }

    let realFile: string;
    try {
      realFile = await realpath(resolve(root, name));
    } catch (error) {
      if (errorCode(error) === 'ENOENT' && attempt === 0) {
        continue;
      }
      logger.warn('Log tail could not resolve the log file:', error);
      return unavailable('unreadable', loggingEnabled);
    }

    if (dirname(realFile) !== root) {
      logger.warn('Log tail rejected a log file that resolves outside the log directory');
      return unavailable('unreadable', loggingEnabled);
    }

    let preOpenStats;
    try {
      preOpenStats = await stat(realFile);
    } catch (error) {
      if (errorCode(error) === 'ENOENT' && attempt === 0) {
        continue;
      }
      logger.warn('Log tail could not stat the log file:', error);
      return unavailable('unreadable', loggingEnabled);
    }

    let handle;
    try {
      handle = await open(realFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ELOOP') {
        logger.warn('Log tail refused to open a log file that had become a symlink');
        return unavailable('unreadable', loggingEnabled);
      }
      if (code === 'ENOENT' && attempt === 0) {
        continue;
      }
      logger.warn('Log tail could not open the log file:', error);
      return unavailable('unreadable', loggingEnabled);
    }

    try {
      const stats = await handle.stat();

      if (stats.ino !== preOpenStats.ino || stats.dev !== preOpenStats.dev) {
        logger.warn('Log tail rejected a log file that was replaced between the stat and the open');
        return unavailable('unreadable', loggingEnabled);
      }

      const size = stats.size;
      const start = Math.max(0, size - MAX_READ_BYTES);
      const length = size - start;

      let text = '';
      if (length > 0) {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, start);
        text = buffer.subarray(0, bytesRead).toString('utf8');
      }

      const hadOffset = start > 0;
      const rawLines = extractTailLines(text, MAX_LINES, hadOffset);

      let clipped = false;
      const lines = rawLines.map((line) => {
        // The file transport writes JSON that was sanitized on the way in, but
        // the file may predate a pattern change,redact again on the way out.
        const sanitized = sanitizeMessage(line);
        if (sanitized.length > MAX_LINE_LENGTH) {
          clipped = true;
          return `${sanitized.slice(0, MAX_LINE_LENGTH)}…`;
        }
        return sanitized;
      });

      return {
        available: true,
        loggingEnabled,
        file: basename(realFile),
        modifiedAt: stats.mtime.toISOString(),
        sizeBytes: size,
        lineCount: lines.length,
        truncated: hadOffset || clipped || lines.length >= MAX_LINES,
        lines,
      };
    } catch (error) {
      logger.warn('Log tail could not read the log file:', error);
      return unavailable('unreadable', loggingEnabled);
    } finally {
      await handle.close();
    }
  }

  return unavailable('no-log-files', loggingEnabled);
}
