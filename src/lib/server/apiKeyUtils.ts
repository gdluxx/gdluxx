/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ApiKey } from '$lib/types/apiKey';

export function isValidApiKey(item: unknown): item is ApiKey {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    typeof (item as Record<string, unknown>).hashedKey === 'string' &&
    typeof (item as Record<string, unknown>).createdAt === 'string'
  );
}
