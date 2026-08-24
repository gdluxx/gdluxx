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
import { isHttpError, isRedirect } from '@sveltejs/kit';

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
const COUNT_QUERY = 'SELECT COUNT(*) as count FROM user';

function makeEvent(pathname: string, headers: Record<string, string> = {}) {
  return {
    url: new URL(`http://localhost${pathname}`),
    request: new Request(`http://localhost${pathname}`, { headers }),
    locals: {},
  };
}

async function captureRedirect(promise: unknown): Promise<{ status: number; location: string }> {
  try {
    await promise;
  } catch (error) {
    if (isRedirect(error)) {
      return { status: error.status, location: error.location };
    }
    throw error;
  }
  throw new Error('expected a redirect to be thrown');
}

describe('user-existence check (REM-002: fail-closed on indeterminate state)', () => {
  test('empty user table redirects a non-public route to /auth/setup', async () => {
    db.exec('DELETE FROM user');
    const resolve = vi.fn(async () => new Response('ok'));

    const redirectInfo = await captureRedirect(
      handle({ event: makeEvent('/dashboard'), resolve } as never),
    );

    expect(redirectInfo.status).toBe(302);
    expect(redirectInfo.location).toBe('/auth/setup');
    expect(resolve).not.toHaveBeenCalled();
  });

  test('existing user with no session redirects to /auth/login, not /auth/setup', async () => {
    db.exec('DELETE FROM user');
    await auth.api.signUpEmail({
      body: { email: 'admin@example.test', password: PASSWORD, name: 'Admin' },
    });
    const resolve = vi.fn(async () => new Response('ok'));

    const redirectInfo = await captureRedirect(
      handle({ event: makeEvent('/dashboard'), resolve } as never),
    );

    expect(redirectInfo.status).toBe(302);
    expect(redirectInfo.location).toBe('/auth/login');
    expect(resolve).not.toHaveBeenCalled();
  });

  test('REM-002: a thrown user-count query fails closed with 503, not fail-open to /auth/setup', async () => {
    db.exec('DELETE FROM user');

    const originalPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
      if (sql === COUNT_QUERY) {
        throw new Error('simulated transient DB error');
      }
      return originalPrepare(sql);
    }) as typeof db.prepare);

    try {
      const resolve = vi.fn(async () => new Response('ok'));
      try {
        const response = (await handle({
          event: makeEvent('/dashboard'),
          resolve,
        } as never)) as Response;
        expect(response.status).toBe(503);
      } catch (error) {
        if (isRedirect(error)) {
          throw new Error(`expected a 503 fail-closed, got a redirect to ${error.location}`, {
            cause: error,
          });
        }
        // A thrown SvelteKit error(503) is an equally valid fail-closed shape.
        if (isHttpError(error) && error.status === 503) {
          return;
        }
        throw error;
      }
    } finally {
      spy.mockRestore();
    }
  });
});
