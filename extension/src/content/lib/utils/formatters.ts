/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ExtractionProfile } from '#src/content/types';

export function formatTimestamp(value?: number): string {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function describeExtractionProfile(profile: ExtractionProfile): string {
  if (profile.name?.trim()) return profile.name.trim();
  if (profile.scope === 'path' && profile.path) return `${profile.host}${profile.path}`;
  if (profile.scope === 'origin' && profile.origin) return profile.origin;
  return profile.host;
}
