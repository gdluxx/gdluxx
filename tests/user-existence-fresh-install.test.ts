/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Every other suite mocks node:fs's existsSync to special-case the
 * ':memory:' DATABASE_PATH sentinel, so getUserCountState()'s "the DB file
 * genuinely does not exist on disk" branch is never exercised as false.
 * This fills that fresh-install gap.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let currentTmpDir = '';
const getSharedDatabaseMock = vi.fn();

vi.mock('$lib/server/database', () => ({
  get DATABASE_PATH() {
    return join(currentTmpDir, 'gdluxx.db');
  },
  getSharedDatabase: (...args: unknown[]) => getSharedDatabaseMock(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  currentTmpDir = mkdtempSync(join(tmpdir(), 'gdluxx-fresh-install-'));
});

afterEach(() => {
  rmSync(currentTmpDir, { recursive: true, force: true });
});

describe('getUserCountState: fresh install, no DB file on disk at all', () => {
  test('resolves to zero without ever opening a database', async () => {
    const { getUserCountState } = await import('$lib/server/auth/userExistence');

    const state = await getUserCountState();

    expect(state).toBe('zero');
    expect(getSharedDatabaseMock).not.toHaveBeenCalled();
  });

  test('the setup page load() allows setup (no redirect, no error) in this state', async () => {
    const { load } = await import('../src/routes/auth/setup/+page.server');

    const result = await load({} as never);

    expect(result).toEqual({});
    expect(getSharedDatabaseMock).not.toHaveBeenCalled();
  });
});
