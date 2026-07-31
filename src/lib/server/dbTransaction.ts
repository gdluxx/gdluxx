/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getSharedDatabase } from '$lib/server/database';

export function withTransaction<T>(fn: () => T): T {
  return getSharedDatabase().transaction(fn)();
}
