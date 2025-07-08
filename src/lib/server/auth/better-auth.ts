/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { betterAuth } from 'better-auth';
import { apiKey } from 'better-auth/plugins';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ensureDir } from '$lib/utils/fs';

const dataDir: string = join(process.cwd(), 'data');

(async () => {
  await ensureDir(dataDir);
})();

const dbPath: string = join(dataDir, 'gdluxx.db');
const db = new Database(dbPath);

try {
  const schemaPaths = [
    join(process.cwd(), 'schema.sql'), // prod (docker)
    join(process.cwd(), 'src', 'lib', 'server', 'schema.sql'), // dev
  ];

  let schemaPath: string | null = null;
  for (const path of schemaPaths) {
    if (existsSync(path)) {
      schemaPath = path;
      break;
    }
  }

  if (schemaPath) {
    const schema: string = readFileSync(schemaPath, 'utf-8');

    const sessionInfo = db.pragma('table_info(session)') as Array<{ name: string }>;
    const hasTokenColumn: boolean = sessionInfo.some(
      (col: { name: string }): boolean => col.name === 'token'
    );

    if (!hasTokenColumn) {
      // eslint-disable-next-line no-console
      console.log('Migrating database schema to add token column...');
      db.exec('DROP TABLE IF EXISTS session');
      db.exec('DROP TABLE IF EXISTS account');
      db.exec('DROP TABLE IF EXISTS verification');
      db.exec('DROP TABLE IF EXISTS user');
    }
    db.exec(schema);

    const apiKeyTableInfo = db.pragma('table_info(apiKey)') as Array<{ name: string }>;

    if (apiKeyTableInfo.length === 0) {
      // eslint-disable-next-line no-console
      console.log('Creating API key table for better-auth plugin...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS apiKey (
          id TEXT PRIMARY KEY,
          name TEXT,
          start TEXT,
          prefix TEXT,
          key TEXT NOT NULL,
          userId TEXT NOT NULL,
          refillInterval INTEGER,
          refillAmount INTEGER,
          lastRefillAt INTEGER,
          enabled BOOLEAN NOT NULL DEFAULT 1,
          rateLimitEnabled BOOLEAN NOT NULL DEFAULT 0,
          rateLimitTimeWindow INTEGER,
          rateLimitMax INTEGER,
          requestCount INTEGER NOT NULL DEFAULT 0,
          remaining INTEGER,
          lastRequest INTEGER,
          expiresAt INTEGER,
          createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          permissions TEXT,
          metadata TEXT,
          FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_apiKey_userId ON apiKey(userId);
        CREATE INDEX IF NOT EXISTS idx_apiKey_key ON apiKey(key);
      `);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('Schema file not found at any of the expected paths:', schemaPaths);
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('Could not initialize database schema:', error);
}

function isIpAddress(str: string): boolean {
  const schemeRemoved: string = str.replace(/^(https?:\/\/)/, '');

  const ipv4Regex = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  return ipv4Regex.test(schemeRemoved);
}

// Build trusted origins called at runtime
function buildTrustedOrigins(): string[] {
  const host: string | undefined = process.env.HOST;
  const port: string | undefined = process.env.PORT;
  const trustedOrigins: string[] = [];

  // environment variables may not be available during build time
  if (!host) {
    // Return empty array during build to be populated at runtime
    return [];
  }

  if (host.startsWith('http://') || host.startsWith('https://')) {
    if (isIpAddress(host) && !port) {
      throw new Error(
        `PORT required when HOST is IP address with scheme. Got HOST? ${host}, PORT: ${port}`
      );
    }
    trustedOrigins.push(host);
  } else {
    if (!port) {
      throw new Error(
        `PORT must be defined when HOST is not a full URL. Got PORT? ${host}, PORT: ${port}`
      );
    }
    trustedOrigins.push(`http://${host}:${port}`, `https://${host}:${port}`);
  }

  // Add localhost variations if host is a bind-all address, or localhost, with a port
  if (port && (host === '0.0.0.0' || host === 'localhost' || host === '127.0.0.1')) {
    trustedOrigins.push(
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
      `https://localhost:${port}`,
      `https://127.0.0.1:${port}`
    );
  }

  return trustedOrigins;
}

export const auth = betterAuth({
  database: db,
  secret: process.env.AUTH_SECRET || 'fallback-secret-please-set-AUTH_SECRET-in-production',
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: buildTrustedOrigins(),
  plugins: [
    apiKey({
      defaultPrefix: 'sk_',
    }),
  ],
  advanced: {
    database: {
      generateId: (): string => uuidv4(),
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
