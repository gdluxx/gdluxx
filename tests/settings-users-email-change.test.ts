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
import { isActionFailure } from '@sveltejs/kit';

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
const { actions } = await import('../src/routes/settings/users/+page.server');

const PASSWORD = 'correct-horse-battery-staple';

function getUserEmail(userId: string): string {
  const row = db.prepare('SELECT email FROM user WHERE id = ?').get(userId) as {
    email: string;
  };
  return row.email;
}

async function signUpAndGetSession(
  email: string,
): Promise<{ userId: string; cookie: string; user: unknown; session: unknown }> {
  const { headers, response } = await auth.api.signUpEmail({
    returnHeaders: true,
    body: { email, password: PASSWORD, name: 'Owner' },
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

  const sessionResult = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!sessionResult) {
    throw new Error('expected a session immediately after signup');
  }

  return {
    userId: response.user.id,
    cookie,
    user: sessionResult.user,
    session: sessionResult,
  };
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function buildEvent(
  cookie: string,
  fields: Record<string, string>,
  overrides: { locals?: Record<string, unknown> } = {},
) {
  return {
    request: new Request('http://localhost/settings/users', {
      method: 'POST',
      body: buildFormData(fields),
      headers: { cookie },
    }),
    locals: overrides.locals ?? {},
  } as never;
}

describe('changeEmail action', () => {
  test('correct current password + new email: succeeds and persists the lowercased email', async () => {
    db.exec('DELETE FROM user');
    const { cookie, user, session } = await signUpAndGetSession('owner1@example.test');

    const result = await actions.changeEmail(
      buildEvent(
        cookie,
        { newEmail: 'New-Owner1@Example.test', currentPassword: PASSWORD },
        { locals: { user, session } },
      ),
    );

    expect(isActionFailure(result)).toBe(false);
    expect((result as { success: boolean }).success).toBe(true);
    expect(getUserEmail((user as { id: string }).id)).toBe('new-owner1@example.test');
  });

  test('wrong current password: 400 with generic message, email unchanged', async () => {
    db.exec('DELETE FROM user');
    const { cookie, user, session } = await signUpAndGetSession('owner2@example.test');

    const result = await actions.changeEmail(
      buildEvent(
        cookie,
        { newEmail: 'new-owner2@example.test', currentPassword: 'totally-wrong-password' },
        { locals: { user, session } },
      ),
    );

    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) {
      expect(result.status).toBe(400);
      expect(result.data).toEqual({ error: 'Current password is incorrect.', success: false });
    }
    expect(getUserEmail((user as { id: string }).id)).toBe('owner2@example.test');
  });

  test('locals.user absent: 401, email unchanged', async () => {
    db.exec('DELETE FROM user');
    const { cookie, user } = await signUpAndGetSession('owner3@example.test');

    const result = await actions.changeEmail(
      buildEvent(cookie, { newEmail: 'new-owner3@example.test', currentPassword: PASSWORD }, {}),
    );

    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) {
      expect(result.status).toBe(401);
      expect(result.data).toEqual({ error: 'Not authenticated.', success: false });
    }
    expect(getUserEmail((user as { id: string }).id)).toBe('owner3@example.test');
  });

  test('missing currentPassword field: 400, email unchanged', async () => {
    db.exec('DELETE FROM user');
    const { cookie, user, session } = await signUpAndGetSession('owner4@example.test');

    const result = await actions.changeEmail(
      buildEvent(cookie, { newEmail: 'new-owner4@example.test' }, { locals: { user, session } }),
    );

    expect(isActionFailure(result)).toBe(true);
    if (isActionFailure(result)) {
      expect(result.status).toBe(400);
      expect(result.data).toEqual({
        error: 'Your current password is required to change the email address.',
        success: false,
      });
    }
    expect(getUserEmail((user as { id: string }).id)).toBe('owner4@example.test');
  });
});
