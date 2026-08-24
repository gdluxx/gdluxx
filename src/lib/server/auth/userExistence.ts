/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { existsSync } from 'node:fs';
import { DATABASE_PATH, getSharedDatabase } from '$lib/server/database';

// 'unknown' means the check itself failed (DB error) and must be treated as
// fail-closed by the caller, distinct from 'zero', which means the check
// succeeded and found a legitimate fresh install. The zero-vs-unknown split is
// what lets signup closure and the setup-page guard reuse this safely.
export type UserCountState = 'zero' | 'nonzero' | 'unknown';

export async function getUserCountState(): Promise<UserCountState> {
  try {
    if (!existsSync(DATABASE_PATH)) {
      return 'zero';
    }

    const db = getSharedDatabase();

    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
      .all();

    if (tableCheck.length === 0) {
      return 'zero';
    }

    const result = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number };

    return result.count > 0 ? 'nonzero' : 'zero';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking user count:', error);
    return 'unknown';
  }
}
