/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ProfileScope } from './types';

export function normaliseHost(host: string): string {
  return host.trim().toLowerCase();
}

export function normalisePath(path: string | undefined | null): string | undefined {
  if (!path) {
    return undefined;
  }
  if (path === '/') {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function normaliseOrigin(origin: string | undefined | null): string | undefined {
  if (!origin) {
    return undefined;
  }
  return origin.trim();
}

export function buildProfileId(
  scope: ProfileScope,
  host: string,
  origin?: string,
  path?: string,
): string {
  const safeHost = normaliseHost(host);
  if (scope === 'path') {
    const safePath = normalisePath(path) ?? '/';
    return `${scope}::${safeHost}::${safePath}`;
  }
  if (scope === 'origin') {
    const safeOrigin = normaliseOrigin(origin) ?? safeHost;
    return `${scope}::${safeHost}::${safeOrigin}`;
  }
  return `${scope}::${safeHost}`;
}
