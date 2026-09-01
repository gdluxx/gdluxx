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
 * A hostile persisted config must block keyword-info before execFile runs.
 * The process call is replaced with a callback-shaped stub.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestHandler } from '@sveltejs/kit';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (
    file: string,
    args: string[],
    options: unknown,
    callback: (error: unknown, result: { stdout: string; stderr: string }) => void,
  ) => {
    execFileMock(file, args, options);
    callback(null, { stdout: 'gdluxx-rem006-sentinel output', stderr: '' });
  },
}));

// The route always validates PATHS.CONFIG_FILE. Live getters provide each test
// an isolated config without touching the repository's persisted data.
let currentTmpDir = '';
vi.mock('$lib/server/constants', () => ({
  PATHS: {
    get BIN_FILE() {
      return join(currentTmpDir, 'gallery-dl.bin');
    },
    get DATA_DIR() {
      return currentTmpDir;
    },
    get CONFIG_FILE() {
      return join(currentTmpDir, 'config.json');
    },
    get COOKIES_DIR() {
      return join(currentTmpDir, 'cookies');
    },
  },
  TERMINAL: { NAME: 'xterm-256color', COLS: 120, ROWS: 30 },
  API_LIMITS: { MAX_BATCH_URLS: 10000 },
}));

const { POST } = await import('../src/routes/api/keyword-info/+server');
const { resetConfigGuardCache } = await import('$lib/server/jobs/configGuard');

const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;
const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

function writeConfig(content: string): void {
  writeFileSync(join(currentTmpDir, 'config.json'), content, 'utf-8');
}

function hostileExecConfig(): string {
  return JSON.stringify({
    extractor: { postprocessors: [{ name: 'exec', command: ['gdluxx-rem006-sentinel'] }] },
  });
}

function benignConfig(): string {
  return JSON.stringify({ extractor: { 'base-directory': join(currentTmpDir, 'downloads') } });
}

function deeplyNestedConfig(): string {
  let nested: unknown = { leaf: true };
  for (let i = 0; i < 66; i++) {
    nested = { nested };
  }
  return JSON.stringify({ nested });
}

async function loadKeywordInfo(mode: 'restricted' | 'unrestricted') {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
  const [route, configGuard] = await Promise.all([
    import('../src/routes/api/keyword-info/+server'),
    import('$lib/server/jobs/configGuard'),
  ]);
  return { route, configGuard };
}

function requestEvent(body: unknown): Parameters<RequestHandler>[0] {
  return {
    request: new Request('http://localhost/api/keyword-info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    locals: { user: { id: 'test-user' } },
  } as unknown as Parameters<RequestHandler>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  currentTmpDir = mkdtempSync(join(tmpdir(), 'gdluxx-keyword-info-'));
  process.env.FILE_STORAGE_PATH = currentTmpDir;
  resetConfigGuardCache();
});

afterEach(() => {
  resetConfigGuardCache();
  rmSync(currentTmpDir, { recursive: true, force: true });
  if (ORIGINAL_FILE_STORAGE_PATH === undefined) {
    delete process.env.FILE_STORAGE_PATH;
  } else {
    process.env.FILE_STORAGE_PATH = ORIGINAL_FILE_STORAGE_PATH;
  }
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
  vi.resetModules();
});

describe('keyword-info config guard deployment posture', () => {
  test('Restricted blocks a saved command finding before execFile', async () => {
    const { route } = await loadKeywordInfo('restricted');
    execFileMock.mockClear();
    writeConfig(hostileExecConfig());

    const response = await route.POST(
      requestEvent({ url: 'https://sentinel.invalid/x', command: 'extractor-info' }),
    );

    expect(response.status).toBe(409);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  test('Unrestricted permits a saved command finding through the config guard', async () => {
    const { route } = await loadKeywordInfo('unrestricted');
    execFileMock.mockClear();
    writeConfig(hostileExecConfig());

    const response = await route.POST(
      requestEvent({ url: 'https://sentinel.invalid/x', command: 'extractor-info' }),
    );

    expect(response.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  test.each(['restricted', 'unrestricted'] as const)(
    '%s blocks malformed and excessively nested config before execFile',
    async (mode) => {
      const { route, configGuard } = await loadKeywordInfo(mode);

      for (const content of ['not valid json {{', deeplyNestedConfig()]) {
        configGuard.resetConfigGuardCache();
        execFileMock.mockClear();
        writeConfig(content);

        const response = await route.POST(
          requestEvent({ url: 'https://sentinel.invalid/x', command: 'extractor-info' }),
        );

        expect(response.status).toBe(409);
        expect(execFileMock).not.toHaveBeenCalled();
      }
    },
  );
});

describe('keyword-info-config-guard [REM-006]', () => {
  test('T-3.1: a hostile on-disk config blocks the request with 409; execFile is never called', async () => {
    writeConfig(hostileExecConfig());

    const response = await POST(
      requestEvent({ url: 'https://sentinel.invalid/x', command: 'extractor-info' }),
    );

    expect(response.status).toBe(409);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  test('T-3.2 (regression): a benign on-disk config reaches execFile', async () => {
    writeConfig(benignConfig());

    const response = await POST(
      requestEvent({ url: 'https://sentinel.invalid/x', command: 'extractor-info' }),
    );

    expect(response.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });
});
