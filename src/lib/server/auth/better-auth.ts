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
import { APIError } from 'better-auth/api';
import { apiKey } from '@better-auth/api-key';
import { building } from '$app/environment';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { openDatabase } from '$lib/server/database';
import { assertAuthSecretConfigured } from '$lib/server/environment';
import { migrateApiKeyTable, backfillApiKeyPermissions } from './apiKeyTableMigration';
import { normalizeBooleanOptionValues } from '$lib/server/optionValueMigration';
import { API_KEY_STATEMENTS } from '$lib/server/apikey/permissions';

// The build imports this module with NODE_ENV=production and no AUTH_SECRET;
// only a real boot may fail closed on it.
if (!building) {
  assertAuthSecretConfigured(process.env.AUTH_SECRET, process.env.NODE_ENV);

  if (!process.env.AUTH_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('AUTH_SECRET is not set. Generate one with: openssl rand -hex 32');
  }
}

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
      // `token` is UNIQUE NOT NULL, so it cannot be added in place to a
      // populated table. Recreating `session` only costs a re-login;
      // `user`/`account`/`verification` hold the only copy of the credentials
      // and are never dropped.
      // eslint-disable-next-line no-console
      console.log('Migrating database schema to add token column; sessions will be reset...');
      db.exec('DROP TABLE IF EXISTS session');
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
    backfillApiKeyPermissions(db);
    normalizeBooleanOptionValues(db);
  } else {
    // Fail closed: without a schema the DB has no `user` table, which the
    // setup path would read as a fresh install and reopen bootstrap on.
    throw new Error(
      `Schema file not found at any of the expected paths: ${schemaPaths.join(', ')}`,
    );
  }
} catch (error) {
  // Fail closed: a half-migrated database must abort boot rather than serve
  // requests against it.
  // eslint-disable-next-line no-console
  console.error('Fatal: could not initialize database schema:', error);
  if (error instanceof Error && error.message.includes('idx_user_singleton')) {
    // eslint-disable-next-line no-console
    console.error(
      'The single-administrator invariant (REM-005) could not be applied because the ' +
        'user table already holds more than one row. This is an abnormal/compromised ' +
        'state. Inspect the user table on the mounted database, remove the extra ' +
        'account(s) so exactly one remains, then restart.',
    );
  }
  throw error;
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

// Derive Secure directly from the configured origin so library parsing changes
// cannot alter it. An absent or invalid origin defers to Better Auth's
// environment fallback.
function resolveSecureCookies(): boolean | undefined {
  const value: string | undefined = process.env.USE_SECURE_COOKIES;
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const baseURL: string | undefined = resolveAppBaseURL();
  if (!baseURL) {
    return undefined;
  }
  try {
    return new URL(baseURL).protocol === 'https:';
  } catch {
    return undefined;
  }
}

// Better Auth's default derives the client IP from X-Forwarded-For.
// On a directly exposed instance that header is attacker-controlled, so rotating
// it would let an attacker bypass the login limiter. Only when TRUSTED_PROXY_HEADER
// names the header a trusted reverse proxy sets do we read the client IP from it.
function resolveIpAddressConfig(): { ipAddressHeaders: string[] } {
  const header: string | undefined = process.env.TRUSTED_PROXY_HEADER?.trim();
  if (header) {
    return { ipAddressHeaders: [header] };
  }
  // Direct-exposed default: an EMPTY header list, NOT disableIpTracking.
  // disableIpTracking:true makes Better Auth skip the limiter for every request
  // (getIp -> null, resolveRateLimitConfig -> null, onRequestRateLimit no-ops), so
  // the /sign-in/email rule would never fire. An empty ipAddressHeaders reads no
  // header at all, so getIp still resolves to null and the limiter runs on one
  // non-spoofable global bucket. A rotated XFF can no longer key (or reset) that
  // bucket. Do NOT "simplify" this back to disableIpTracking, it reopens AUTH-005.
  return { ipAddressHeaders: [] };
}

export const auth = betterAuth({
  database: db,
  // Better Auth refuses to construct under NODE_ENV=production without a secret,
  // and the build runs in that mode with AUTH_SECRET unset. Generated per build
  // rather than hard-coded so it can never become a shared cross-install signing
  // key; at runtime `building` is false and an absent AUTH_SECRET has already
  // aborted boot above.
  secret: building ? randomBytes(32).toString('hex') : process.env.AUTH_SECRET,
  baseURL: resolveAppBaseURL(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Server-enforced; SetupForm.svelte mirrors this client-side.
    minPasswordLength: 8,
  },
  // enforce the single-administrator invariant at the data
  // layer. This is the only mechanism that can distinguish the first user (the
  // bootstrap admin) from every later signup; the idx_user_singleton UNIQUE
  // index is the atomic backstop for the read-then-write race below.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const { count } = db.prepare('SELECT COUNT(*) as count FROM user').get() as {
            count: number;
          };
          if (count >= 1) {
            throw new APIError('BAD_REQUEST', { message: 'Registration is closed.' });
          }
          return { data: user };
        },
      },
    },
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
    // Deliberate: without this, every request inside updateAge pushes
    // expiresAt forward, so an active session never actually reaches
    // expiresIn. This caps it as a true absolute lifetime; an active user
    // re-authenticates once the 7 days are up.
    disableSessionRefresh: true,
  },
  // Better-Auth specific trusted origins
  trustedOrigins: buildTrustedOrigins(),
  // Explicit so the limiter does not silently depend on the
  // NODE_ENV-gated default. The whole /api/auth subtree gets the global window;
  // /sign-in/email is tightened for brute-force resistance.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
    },
  },
  // The app never calls auth.api.listSessions (it lists sessions via
  // raw SQL in sessionManager), so disabling the HTTP endpoint is safe defense
  // in depth alongside the path-normalized hook denylist. /change-email is
  // deliberately NOT here: the password-reauthenticated flow uses the internal
  // auth.api.changeEmail, and disabledPaths' effect on internal calls is
  // unverified, it stays in the hook denylist instead.
  disabledPaths: ['/list-sessions'],
  plugins: [
    apiKey({
      defaultPrefix: 'sk_',
      rateLimit: {
        enabled: false,
      },
      permissions: {
        defaultPermissions: API_KEY_STATEMENTS,
      },
      // No gdluxx surface reads the stored key prefix, and verification
      // matches the hashed full key alone, so a fragment of key material need
      // not persist at rest (AUTH-019b). Pre-existing rows keep their stored
      // value; the `start` column stays.
      startingCharactersConfig: {
        shouldStore: false,
      },
    }),
  ],
  advanced: {
    database: {
      generateId: (): string => uuidv4(),
    },
    useSecureCookies: resolveSecureCookies(),
    ipAddress: resolveIpAddressConfig(),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
