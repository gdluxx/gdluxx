/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

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

// Isolate the real executor from any machine-local persisted config.
vi.mock('$lib/server/jobs/configGuard', () => ({
  assertConfigFileSafeForExecution: vi.fn().mockResolvedValue(undefined),
  resetConfigGuardCache: vi.fn(),
}));

const { executeGalleryDlCommand, executeGalleryDlBatchCommand } =
  await import('$lib/server/jobs/commandExecutor');

function fakePty() {
  return {
    pid: 1234,
    onData: () => undefined,
    onExit: () => undefined,
  };
}

describe('commandExecutor: job completion when spawn throws', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createJobMock.mockImplementation(async () => 'job-1');
    createBatchJobMock.mockImplementation(async () => 'batch-job-1');
    setJobProcessMock.mockResolvedValue(undefined);
    addOutputMock.mockResolvedValue(undefined);
    completeJobMock.mockResolvedValue(undefined);
    getCookieFileForUrlMock.mockResolvedValue(null);
  });

  test('executeGalleryDlCommand: a throwing spawn completes the already-created job as failed', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    const result = await executeGalleryDlCommand('https://example.com/x', []);

    expect(result).toEqual({ success: false, error: 'spawn failed' });
    expect(completeJobMock).toHaveBeenCalledWith('job-1', 1);
  });

  test('executeGalleryDlCommand: the success path never calls completeJob', async () => {
    spawnMock.mockImplementation(() => fakePty());

    const result = await executeGalleryDlCommand('https://example.com/x', []);

    expect(result).toEqual({ success: true, jobId: 'job-1' });
    expect(completeJobMock).not.toHaveBeenCalled();
  });

  test('executeGalleryDlCommand: a failure before job creation does not call completeJob (no id to complete)', async () => {
    createJobMock.mockImplementation(async () => {
      throw new Error('db unavailable');
    });

    const result = await executeGalleryDlCommand('https://example.com/x', []);

    expect(result.success).toBe(false);
    expect(completeJobMock).not.toHaveBeenCalled();
  });

  test('executeGalleryDlBatchCommand: a throwing spawn completes the already-created batch job as failed', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    const result = await executeGalleryDlBatchCommand(['https://example.com/x'], []);

    expect(result).toEqual({ success: false, error: 'spawn failed' });
    expect(completeJobMock).toHaveBeenCalledWith('batch-job-1', 1);
  });

  test('executeGalleryDlBatchCommand: the success path never calls completeJob', async () => {
    spawnMock.mockImplementation(() => fakePty());

    const result = await executeGalleryDlBatchCommand(['https://example.com/x'], []);

    expect(result).toEqual({ success: true, jobId: 'batch-job-1' });
    expect(completeJobMock).not.toHaveBeenCalled();
  });
});
