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
 * Direct on-disk config changes must still be contained at execution time.
 * Process spawning is mocked so blocked cases prove no subprocess starts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const createJobMock = vi.fn();
const createBatchJobMock = vi.fn();
const setJobProcessMock = vi.fn();
const addOutputMock = vi.fn();
const completeJobMock = vi.fn();
vi.mock('$lib/server/jobs/jobManager', () => ({
  jobManager: {
    createJob: (...args: unknown[]) => createJobMock(...args),
    createBatchJob: (...args: unknown[]) => createBatchJobMock(...args),
    setJobProcess: (...args: unknown[]) => setJobProcessMock(...args),
    addOutput: (...args: unknown[]) => addOutputMock(...args),
    completeJob: (...args: unknown[]) => completeJobMock(...args),
  },
}));

const spawnMock = vi.fn();
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

const getCookieFileForUrlMock = vi.fn();
vi.mock('$lib/server/cookieFileManager', () => ({
  getCookieFileForUrl: (...args: unknown[]) => getCookieFileForUrlMock(...args),
}));

// These APIs always validate PATHS.CONFIG_FILE. Live getters provide each test
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

const { executeGalleryDlCommand, executeGalleryDlBatchCommand } =
  await import('$lib/server/jobs/commandExecutor');
const { launchUrls } = await import('$lib/server/jobs/commandLauncher');
const { ConfigExecutionBlockedError } = await import('$lib/server/validation/exec-policy');
const { resetConfigGuardCache } = await import('$lib/server/jobs/configGuard');

function fakePty() {
  return { pid: 1234, onData: () => undefined, onExit: () => undefined };
}

const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;
const ORIGINAL_DOWNLOAD_PATH = process.env.DOWNLOAD_PATH;
const ORIGINAL_EXTRA_ROOTS = process.env.GDLUXX_CONFIG_PATH_ROOTS;

let jobCounter = 0;

function writeConfig(content: string): void {
  writeFileSync(join(currentTmpDir, 'config.json'), content, 'utf-8');
}

function hostileExecConfig(): string {
  return JSON.stringify({
    extractor: { postprocessors: [{ name: 'exec', command: ['gdluxx-rem006-sentinel'] }] },
  });
}

function hostilePathConfig(): string {
  return JSON.stringify({ extractor: { 'base-directory': '/gdluxx-rem006-sentinel/root' } });
}

function benignConfig(): string {
  return JSON.stringify({ extractor: { 'base-directory': join(currentTmpDir, 'downloads') } });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentTmpDir = mkdtempSync(join(tmpdir(), 'gdluxx-exec-runtime-'));
  writeFileSync(join(currentTmpDir, 'gallery-dl.bin'), '', { mode: 0o755 });
  process.env.FILE_STORAGE_PATH = currentTmpDir;
  delete process.env.DOWNLOAD_PATH;
  delete process.env.GDLUXX_CONFIG_PATH_ROOTS;
  resetConfigGuardCache();

  jobCounter = 0;
  createJobMock.mockImplementation(async () => `job-${++jobCounter}`);
  createBatchJobMock.mockImplementation(async () => `job-${++jobCounter}`);
  setJobProcessMock.mockResolvedValue(undefined);
  addOutputMock.mockResolvedValue(undefined);
  completeJobMock.mockResolvedValue(undefined);
  getCookieFileForUrlMock.mockResolvedValue(null);
  spawnMock.mockImplementation(() => fakePty());
});

afterEach(() => {
  resetConfigGuardCache();
  rmSync(currentTmpDir, { recursive: true, force: true });
  if (ORIGINAL_FILE_STORAGE_PATH === undefined) {
    delete process.env.FILE_STORAGE_PATH;
  } else {
    process.env.FILE_STORAGE_PATH = ORIGINAL_FILE_STORAGE_PATH;
  }
  if (ORIGINAL_DOWNLOAD_PATH === undefined) {
    delete process.env.DOWNLOAD_PATH;
  } else {
    process.env.DOWNLOAD_PATH = ORIGINAL_DOWNLOAD_PATH;
  }
  if (ORIGINAL_EXTRA_ROOTS === undefined) {
    delete process.env.GDLUXX_CONFIG_PATH_ROOTS;
  } else {
    process.env.GDLUXX_CONFIG_PATH_ROOTS = ORIGINAL_EXTRA_ROOTS;
  }
});

const url = 'https://sentinel.invalid/gallery/1';

describe('exec-containment-runtime: hostile config.json on disk', () => {
  test('T-2.1: executeGalleryDlCommand is blocked, spawn never called, no job row created', async () => {
    writeConfig(hostileExecConfig());

    const result = await executeGalleryDlCommand(url, []);

    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(createJobMock).not.toHaveBeenCalled();
  });

  test('T-2.2: executeGalleryDlBatchCommand is blocked, spawn never called, no job row created', async () => {
    writeConfig(hostileExecConfig());

    const result = await executeGalleryDlBatchCommand([url], []);

    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(createBatchJobMock).not.toHaveBeenCalled();
  });

  test('T-2.3: launchUrls rejects with ConfigExecutionBlockedError, spawn never called', async () => {
    writeConfig(hostileExecConfig());

    await expect(
      launchUrls({
        urls: [url],
        args: [],
        excludedOptions: [],
        resolveSiteOptions: async () => [],
      }),
    ).rejects.toBeInstanceOf(ConfigExecutionBlockedError);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('T-2.4: a hostile base-directory path also blocks execution', async () => {
    writeConfig(hostilePathConfig());

    const result = await executeGalleryDlCommand(url, []);

    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('T-2.5 (regression): a benign on-disk config still spawns', async () => {
    writeConfig(benignConfig());

    const result = await executeGalleryDlCommand(url, []);

    expect(result.success).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test('T-2.6: an absent config.json is allowed (ENOENT)', async () => {
    const result = await executeGalleryDlCommand(url, []);

    expect(result.success).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test('T-2.7: an unreadable config.json (EACCES) fails closed', async () => {
    writeConfig(benignConfig());
    chmodSync(join(currentTmpDir, 'config.json'), 0o000);

    const result = await executeGalleryDlCommand(url, []);

    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('T-2.8: a config.json that is not valid JSON fails closed', async () => {
    writeConfig('not valid json {{');

    const result = await executeGalleryDlCommand(url, []);

    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('T-2.9: the mtime/size cache does not stick across an in-place rewrite', async () => {
    writeConfig(benignConfig());
    const first = await executeGalleryDlCommand(url, []);
    expect(first.success).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);

    writeConfig(hostileExecConfig());
    const second = await executeGalleryDlCommand(url, []);
    expect(second.success).toBe(false);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
