/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/*
 * Rate-limit / proxy-IP / password-policy configuration.
 *
 * Beyond asserting the config surface, this drives real login POSTs through
 * `auth.handler` and asserts the limiter actually throttles after `max`
 * attempts. That runtime check is what catches the "limiter silently off"
 * regression: a `disableIpTracking: true` default makes Better Auth skip the
 * limiter for every request, so no 429 would ever appear while every
 * config-shape assertion still passed.
 */

import { describe, expect, test, vi } from 'vitest';

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';
// Deterministic origin so auth.handler resolves the /sign-in/email path and its
// custom rate-limit rule.
process.env.APP_BASE_URL = 'http://localhost:3000';
// The safe (direct-exposed) default is asserted below, so the proxy override
// must be unset before better-auth.ts reads it at module load.
delete process.env.TRUSTED_PROXY_HEADER;

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readFileSync(schemaUrl, 'utf8'));
  // close() would kill the shared singleton for the rest of the file.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  database.close = (() => {}) as typeof database.close;
  return { db: database };
});

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => db,
  getSharedDatabase: () => db,
}));
vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// A blanket existsSync mock breaks better-auth's schema probe (drops apiKey table);
// scope the override to the DATABASE_PATH sentinel only.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<
    { default: Record<string, unknown> } & Record<string, unknown>
  >();
  const realExistsSync = actual.existsSync as (p: unknown) => boolean;
  const existsSync = (p: unknown): boolean => p === ':memory:' || realExistsSync(p);
  return { ...actual, default: { ...actual.default, existsSync }, existsSync };
});

const { auth } = await import('$lib/server/auth/better-auth');

type Options = typeof auth.options;

function userCount(): number {
  return (db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }).count;
}

describe('REM-010: explicit password policy', () => {
  test('emailAndPassword.minPasswordLength is explicitly 8', () => {
    expect(auth.options.emailAndPassword?.minPasswordLength).toBe(8);
  });

  test('a below-minimum password is rejected server-side by signUpEmail', async () => {
    db.exec('DELETE FROM user');

    await expect(
      auth.api.signUpEmail({
        body: { email: 'shortpw@example.test', password: 'abc', name: 'Short' },
      }),
    ).rejects.toBeDefined();

    expect(userCount()).toBe(0);
  });
});

describe('REM-010: explicit rate limiting', () => {
  test('rateLimit is explicitly enabled and does not depend on the NODE_ENV default', () => {
    expect(auth.options.rateLimit?.enabled).toBe(true);
    expect(typeof auth.options.rateLimit?.window).toBe('number');
    expect(typeof auth.options.rateLimit?.max).toBe('number');
  });

  test('a tightened /sign-in/email custom rule is present', () => {
    const rule = auth.options.rateLimit?.customRules?.['/sign-in/email'];
    expect(rule).toBeDefined();
    const resolved = typeof rule === 'function' ? undefined : rule;
    expect(resolved?.max).toBeGreaterThan(0);
    expect(resolved?.max ?? Infinity).toBeLessThan(auth.options.rateLimit?.max ?? Infinity);
  });
});

describe('REM-010: safe proxy-IP default (AUTH-005)', () => {
  test('with TRUSTED_PROXY_HEADER unset, no client-supplied header is trusted and tracking is NOT disabled', () => {
    const ipAddress = (auth.options as Options).advanced?.ipAddress;
    expect(ipAddress).toEqual({ ipAddressHeaders: [] });
  });

  test('with TRUSTED_PROXY_HEADER set, the named header is read for the client IP', async () => {
    vi.resetModules();
    process.env.TRUSTED_PROXY_HEADER = 'x-forwarded-for';
    try {
      const { auth: proxyAuth } = await import('$lib/server/auth/better-auth');
      const ipAddress = (proxyAuth.options as Options).advanced?.ipAddress;
      expect(ipAddress).toEqual({ ipAddressHeaders: ['x-forwarded-for'] });
    } finally {
      delete process.env.TRUSTED_PROXY_HEADER;
      vi.resetModules();
    }
  });
});

describe('REM-010: login limiter runs at runtime (AUTH-005)', () => {
  const signInUrl = 'http://localhost:3000/api/auth/sign-in/email';

  function signIn(email: string, password: string): Promise<Response> {
    return auth.handler(
      new Request(signInUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email, password }),
      }),
    );
  }

  test('a valid login within the limit succeeds, and attempts throttle (429) past max', async () => {
    db.exec('DELETE FROM session');
    db.exec('DELETE FROM account');
    db.exec('DELETE FROM user');
    await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: 'correct-horse-battery', name: 'Admin' },
    });

    const max = auth.options.rateLimit?.customRules?.['/sign-in/email'];
    const maxAttempts = typeof max === 'function' ? 5 : (max?.max ?? 5);

    // Direct auth.api calls bypass the HTTP limiter, so setup leaves the
    // /sign-in/email bucket untouched until this request.
    const good = await signIn('admin@example.test', 'correct-horse-battery');
    expect(good.status).toBe(200);

    let sawThrottle = false;
    for (let i = 0; i < maxAttempts + 3; i++) {
      const res = await auth.handler(
        new Request(signInUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            // Rotated per attempt: proves the bucket is not keyed on (or resettable
            // via) an attacker-supplied forwarding header.
            'x-forwarded-for': `203.0.113.${i}`,
          },
          body: JSON.stringify({ email: 'admin@example.test', password: 'wrong-password' }),
        }),
      );
      if (res.status === 429) {
        sawThrottle = true;
        break;
      }
    }
    expect(sawThrottle).toBe(true);
  });
});
