/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import path from 'node:path';
import { chmod, mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { PATHS } from '$lib/server/constants';
import { serverLogger as logger } from '$lib/server/logger';
import {
  findCookieDomainForHost,
  isCookieExpired,
  type StoredCookie,
} from '$lib/server/cookieBackupManager';

const NETSCAPE_HEADER = '# Netscape HTTP Cookie File';
const COOKIE_FILE_MODE = 0o600;

function stripFieldSeparators(value: string): string {
  return value.replace(/[\t\r\n]/g, '');
}

export function sanitizeDomainForFilename(domain: string): string | null {
  const normalized = domain.trim().toLowerCase().replace(/^\./, '');
  if (!normalized || normalized.includes('/') || normalized.includes('\\')) {
    return null;
  }

  const sanitized = normalized.replace(/[^a-z0-9.-]/g, '-');
  if (!sanitized.replace(/[.-]/g, '')) {
    return null;
  }
  return sanitized;
}

export function toNetscapeCookieFile(cookies: StoredCookie[], nowSeconds: number): string {
  const lines = [NETSCAPE_HEADER, ''];

  for (const cookie of cookies) {
    if (isCookieExpired(cookie, nowSeconds)) {
      continue;
    }

    const domain = stripFieldSeparators(cookie.domain);
    const prefix = cookie.httpOnly ? '#HttpOnly_' : '';
    const includeSubdomains = cookie.hostOnly === true ? 'FALSE' : 'TRUE';
    const cookiePath = stripFieldSeparators(cookie.path || '/');
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiry =
      cookie.session === true || cookie.expirationDate === undefined
        ? 0
        : Math.floor(cookie.expirationDate);

    lines.push(
      [
        `${prefix}${domain}`,
        includeSubdomains,
        cookiePath,
        secure,
        String(expiry),
        stripFieldSeparators(cookie.name),
        stripFieldSeparators(cookie.value),
      ].join('\t'),
    );
  }

  return `${lines.join('\n')}\n`;
}

export function getCookieFilePath(domain: string): string | null {
  const filename = sanitizeDomainForFilename(domain);
  if (!filename) {
    return null;
  }
  return path.join(PATHS.COOKIES_DIR, `${filename}.txt`);
}

/**
 * Drop every cached file a stored domain could be backing.
 *
 * Cache files are named per job host, so one stored domain can back several
 * (`example.com.txt`, `www.example.com.txt`, `cdn.example.com.txt`). Matching
 * is deliberately over eager in both directions: files are regenerable, so an
 * extra unlink costs one rematerialization, whereas missing one leaves
 * session secrets on disk after the user deleted the backup.
 */
export async function removeCachedCookieFile(domain: string): Promise<void> {
  const target = sanitizeDomainForFilename(domain);
  if (!target) {
    return;
  }

  let entries: string[];
  try {
    entries = await readdir(PATHS.COOKIES_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`Failed to list cached cookie files for domain "${domain}"`, error);
    }
    return;
  }

  const stale = entries.filter((name) => {
    if (!name.endsWith('.txt')) {
      return false;
    }
    const host = name.slice(0, -'.txt'.length);
    return host === target || host.endsWith(`.${target}`) || target.endsWith(`.${host}`);
  });

  await Promise.all(
    stale.map(async (name) => {
      try {
        await unlink(path.join(PATHS.COOKIES_DIR, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.error(`Failed to remove cached cookie file "${name}"`, error);
        }
      }
    }),
  );
}

async function isFileFresh(filePath: string, updatedAt: number): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.size > 0 && stats.mtimeMs >= updatedAt;
  } catch {
    return false;
  }
}

async function writeCookieFile(filePath: string, contents: string): Promise<void> {
  await mkdir(PATHS.COOKIES_DIR, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(tempPath, contents, { encoding: 'utf8', mode: COOKIE_FILE_MODE });
    try {
      await chmod(tempPath, COOKIE_FILE_MODE);
    } catch (error) {
      logger.warn(`Unable to set cookie file permissions on ${tempPath}`, error);
    }
    await rename(tempPath, filePath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {
      /* temp file may not exist */
    }
    throw error;
  }
}

export async function getCookieFileForUrl(url: string): Promise<string | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }

  const match = findCookieDomainForHost(hostname);
  if (!match) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const usable = match.entry.cookies.filter((cookie) => !isCookieExpired(cookie, nowSeconds));
  if (usable.length === 0) {
    logger.warn(
      `All stored cookies for domain "${match.domain}" are expired; continuing without cookies`,
    );
    return null;
  }

  // Named for the job host, not the stored domain key: the fallback lookup can
  // resolve two hosts to the same entry with different applicable subsets, and
  // a shared filename would let a narrow subset satisfy the freshness check for
  // a host that needs the full set.
  const filePath = getCookieFilePath(hostname);
  if (!filePath) {
    logger.warn(`Job host "${hostname}" cannot be mapped to a safe cookie filename`);
    return null;
  }

  try {
    if (await isFileFresh(filePath, match.entry.updatedAt)) {
      return filePath;
    }
    await writeCookieFile(filePath, toNetscapeCookieFile(usable, nowSeconds));
    return filePath;
  } catch (error) {
    logger.error(`Failed to materialize cookie file for domain "${match.domain}"`, error);
    return null;
  }
}
