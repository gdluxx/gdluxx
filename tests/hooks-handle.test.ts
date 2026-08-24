/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { describe, expect, test, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

process.env.AUTH_SECRET = 'phase0-test-secret-not-for-prod-0123456789';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync } = await import('node:fs');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readFileSync(schemaUrl, 'utf8'));
  // close() would kill the shared singleton for the rest of the file; the
  // logger's async config load and getUserCount() both call it.
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
const { handle } = await import('../src/hooks.server');

const PASSWORD = 'correct-horse-battery-staple';

function makeEvent(pathname: string, headers: Record<string, string> = {}) {
  return {
    url: new URL(`http://localhost${pathname}`),
    request: new Request(`http://localhost${pathname}`, { headers }),
    locals: {},
  };
}

async function signUpAndGetCookie(email: string): Promise<{ userId: string; cookie: string }> {
  const { headers, response } = await auth.api.signUpEmail({
    returnHeaders: true,
    body: { email, password: PASSWORD, name: 'Admin' },
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return { userId: response.user.id, cookie };
}

describe('route classification (REM-011: startsWith over-matching, denylist normalization, 401 JSON for /api/*)', () => {
  test('chrome devtools well-known probe short-circuits to 204', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const response = (await handle({
      event: makeEvent('/.well-known/appspecific/com.chrome.devtools/whatever.json'),
      resolve,
    } as never)) as Response;

    expect(response.status).toBe(204);
    expect(resolve).not.toHaveBeenCalled();
  });

  test('public route /auth/login resolves without redirecting, even with an empty user table', async () => {
    db.exec('DELETE FROM user');
    const resolve = vi.fn(async () => new Response('ok'));

    const response = (await handle({
      event: makeEvent('/auth/login'),
      resolve,
    } as never)) as Response;

    expect(resolve).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  test('deniedAuthRoutes are exact-match denied with 404 JSON', async () => {
    for (const pathname of ['/api/auth/change-email', '/api/auth/list-sessions']) {
      const resolve = vi.fn(async () => new Response('ok'));
      const response = (await handle({ event: makeEvent(pathname), resolve } as never)) as Response;

      expect(response.status).toBe(404);
      expect(resolve).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({ error: 'Not found' });
    }
  });

  test('extension route OPTIONS request from an allowed scheme receives CORS headers', async () => {
    const event = {
      url: new URL('http://localhost/api/extension/ping'),
      request: new Request('http://localhost/api/extension/ping', {
        method: 'OPTIONS',
        headers: { origin: 'chrome-extension://abcdef' },
      }),
      locals: {},
    };
    const resolve = vi.fn(async () => new Response('ok'));

    const response = (await handle({ event, resolve } as never)) as Response;

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://abcdef');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(resolve).not.toHaveBeenCalled();
  });

  test('auth.api.changeEmail still works server-side — it never traverses the hook denylist', async () => {
    db.exec('DELETE FROM user');
    const { userId, cookie } = await signUpAndGetCookie('owner@example.test');

    await auth.api.changeEmail({
      body: { newEmail: 'new-owner@example.test' },
      headers: new Headers({ cookie }),
    });

    const row = db.prepare('SELECT email FROM user WHERE id = ?').get(userId) as {
      email: string;
    };
    expect(row.email).toBe('new-owner@example.test');
  });

  test('REM-011: denylist survives duplicate-slash normalization — /api/auth//list-sessions is denied, not public [flip to test() when REM-011 lands]', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const response = (await handle({
      event: makeEvent('/api/auth//list-sessions'),
      resolve,
    } as never)) as Response;

    expect(response.status).toBe(404);
  });

  test('REM-011: denylist survives percent-encoding normalization — /api/auth%2Flist-sessions is denied, not public [flip to test() when REM-011 lands]', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const response = (await handle({
      event: makeEvent('/api/auth%2Flist-sessions'),
      resolve,
    } as never)) as Response;

    expect(response.status).toBe(404);
  });

  test('REM-011: /api/authX prefix over-match is closed — not treated as public [flip to test() when REM-011 lands]', async () => {
    db.exec('DELETE FROM user');
    await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: PASSWORD, name: 'Admin' },
    });
    const resolve = vi.fn(async () => new Response('ok'));

    let response: Response | undefined;
    try {
      response = (await handle({ event: makeEvent('/api/authX'), resolve } as never)) as Response;
    } catch (error) {
      if (!isRedirect(error)) {
        throw error;
      }
    }

    expect(resolve).not.toHaveBeenCalled();
    if (response) {
      expect(response.status).toBe(401);
    }
  });

  test('REM-011: unauth /api/* returns 401 JSON, not a 302 redirect [flip to test() when REM-011 lands]', async () => {
    db.exec('DELETE FROM user');
    await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: PASSWORD, name: 'Admin' },
    });
    const resolve = vi.fn(async () => new Response('ok'));

    let response: Response;
    try {
      response = (await handle({ event: makeEvent('/api/config'), resolve } as never)) as Response;
    } catch (error) {
      if (isRedirect(error)) {
        throw new Error(`expected 401 JSON, got a redirect to ${error.location}`, {
          cause: error,
        });
      }
      throw error;
    }

    expect(response.status).toBe(401);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });
});

function makeExtensionEvent(method: string, origin?: string) {
  const headers: Record<string, string> = origin === undefined ? {} : { origin };
  return {
    url: new URL('http://localhost/api/extension/ping'),
    request: new Request('http://localhost/api/extension/ping', { method, headers }),
    locals: {},
  };
}

describe('extension CORS / PNA allowlist (REM-012: reflect-any-origin oracle closed)', () => {
  test.each([['chrome-extension://abcdef'], ['moz-extension://abcdef']])(
    'preflight from an allowed extension scheme (%s) gets ACAO, PNA, and Vary: Origin',
    async (origin) => {
      const resolve = vi.fn(async () => new Response('ok'));
      const response = (await handle({
        event: makeExtensionEvent('OPTIONS', origin),
        resolve,
      } as never)) as Response;

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
      expect(response.headers.get('Vary')).toBe('Origin');
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  test('actual request from an allowed extension origin gets ACAO + PNA on the resolved response', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const response = (await handle({
      event: makeExtensionEvent('GET', 'chrome-extension://abcdef'),
      resolve,
    } as never)) as Response;

    expect(resolve).toHaveBeenCalledOnce();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://abcdef');
    expect(response.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  test('preflight and actual request from a non-allowed origin get no ACAO/PNA but do get Vary: Origin', async () => {
    for (const method of ['OPTIONS', 'GET']) {
      const resolve = vi.fn(async () => new Response('ok'));
      const response = (await handle({
        event: makeExtensionEvent(method, 'https://evil.example'),
        resolve,
      } as never)) as Response;

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Private-Network')).toBeNull();
      expect(response.headers.get('Vary')).toBe('Origin');
      if (method === 'OPTIONS') {
        expect(resolve).not.toHaveBeenCalled();
      } else {
        // Non-allowed origin is a header-grant decision only; the request
        // itself still reaches resolve() and the route's own Bearer check.
        expect(resolve).toHaveBeenCalledOnce();
      }
    }
  });

  test('a request with no Origin header gets no ACAO/PNA', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const response = (await handle({
      event: makeExtensionEvent('GET'),
      resolve,
    } as never)) as Response;

    expect(resolve).toHaveBeenCalledOnce();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Private-Network')).toBeNull();
  });

  test('the configured ORIGIN is allowed when set', async () => {
    const previousOrigin = process.env.ORIGIN;
    process.env.ORIGIN = 'https://gdluxx.example.test';
    try {
      const resolve = vi.fn(async () => new Response('ok'));
      const response = (await handle({
        event: makeExtensionEvent('OPTIONS', 'https://gdluxx.example.test'),
        resolve,
      } as never)) as Response;

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://gdluxx.example.test',
      );
      expect(response.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
    } finally {
      if (previousOrigin === undefined) {
        delete process.env.ORIGIN;
      } else {
        process.env.ORIGIN = previousOrigin;
      }
    }
  });
});
