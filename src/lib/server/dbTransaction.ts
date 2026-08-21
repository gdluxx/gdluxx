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

// The jobs subsystem writes continuously on a different connection during
// downloads; a deferred transaction on the shared connection can fail
// SQLITE_BUSY immediately on lock upgrade, while IMMEDIATE takes the write
// lock up front and waits out the busy timeout instead.
export function withImmediateTransaction<T>(fn: () => T): T {
  return getSharedDatabase().transaction(fn).immediate();
}
