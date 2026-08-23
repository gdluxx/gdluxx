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
import { apiKey } from '@better-auth/api-key';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { openDatabase } from '$lib/server/database';
import { migrateApiKeyTable } from './apiKeyTableMigration';

const db = openDatabase();

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
      (col: { name: string }): boolean => col.name === 'token',
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

    const userInfo = db.pragma('table_info(user)') as Array<{ name: string }>;
    const hasMaxBatchUrls = userInfo.some((col) => col.name === 'maxBatchUrls');
    if (!hasMaxBatchUrls) {
      // eslint-disable-next-line no-console
      console.log('Migrating database schema to add maxBatchUrls column...');
      db.exec('ALTER TABLE user ADD COLUMN maxBatchUrls INTEGER DEFAULT 200');
    }

    migrateApiKeyTable(db);
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

function resolveAppBaseURL(): string | undefined {
  return process.env.APP_BASE_URL || process.env.ORIGIN || undefined;
}

// NOTE: ORIGIN feeds both this Better-Auth validation and SvelteKit's own
// CSRF check; the two are enforced independently
function buildTrustedOrigins(): string[] {
  const host: string | undefined = process.env.HOST;
  const port: string | undefined = process.env.PORT;
  const baseURL: string | undefined = resolveAppBaseURL();
  const trustedOrigins: string[] = [];

  if (baseURL) {
    trustedOrigins.push(new URL(baseURL).origin);
  }

  // If env variables aren't during build time
  if (!host) {
    return trustedOrigins;
  }

  if (host.startsWith('http://') || host.startsWith('https://')) {
    if (isIpAddress(host) && !port) {
      throw new Error(
        `PORT required when HOST is IP address with scheme. Got HOST? ${host}, PORT: ${port}`,
      );
    }
    trustedOrigins.push(host);
  } else {
    if (!port) {
      throw new Error(
        `PORT must be defined when HOST is not a full URL. Got PORT? ${host}, PORT: ${port}`,
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
      `https://127.0.0.1:${port}`,
    );
  }

  // Remove dups
  const uniqueOrigins = [...new Set(trustedOrigins)];

  return uniqueOrigins;
}

// undefined defers to Better Auth: Secure derives from the baseURL scheme,
// or from NODE_ENV === 'production' when no baseURL resolves
function resolveSecureCookies(): boolean | undefined {
  const value: string | undefined = process.env.USE_SECURE_COOKIES;
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

export const auth = betterAuth({
  database: db,
  secret: process.env.AUTH_SECRET || 'fallback-secret-please-set-AUTH_SECRET-in-production',
  baseURL: resolveAppBaseURL(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // Better-Auth specific trusted origins
  trustedOrigins: buildTrustedOrigins(),
  plugins: [
    apiKey({
      defaultPrefix: 'sk_',
      rateLimit: {
        enabled: false,
      },
    }),
  ],
  advanced: {
    database: {
      generateId: (): string => uuidv4(),
    },
    useSecureCookies: resolveSecureCookies(),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
