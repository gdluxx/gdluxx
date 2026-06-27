/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { building } from '$app/environment';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PATHS } from '$lib/server/constants';

export const DATABASE_PATH = path.join(PATHS.DATA_DIR, 'gdluxx.db');

export function openDatabase(): Database.Database {
  if (building) {
    const database = new Database(':memory:');
    const schemaPaths = [
      path.join(process.cwd(), 'schema.sql'),
      path.join(process.cwd(), 'src', 'lib', 'server', 'schema.sql'),
    ];
    const schemaPath = schemaPaths.find((candidate) => existsSync(candidate));

    if (schemaPath) {
      database.exec(readFileSync(schemaPath, 'utf8'));
    }

    return database;
  }

  mkdirSync(PATHS.DATA_DIR, { recursive: true });
  return new Database(DATABASE_PATH);
}
