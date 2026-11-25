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
import type { JobQueueHandlers } from '$lib/server/jobs/jobQueue';
import type { QueuedExecution } from '$lib/server/jobs/queuedExecution';

const loggerInfoMock = vi.fn();
vi.mock('$lib/server/logger', () => ({
  serverLogger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const createQueuedJobMock = vi.fn();
const setJobProcessMock = vi.fn();
const addOutputMock = vi.fn();
const completeJobMock = vi.fn();
const failJobMock = vi.fn();
vi.mock('$lib/server/jobs/jobManager', () => ({
  jobManager: {
    createQueuedJob: (...args: unknown[]) => createQueuedJobMock(...args),
    getJob: async () => ({ status: 'running' }),
    markQueuedJobRunning: () => true,
    setJobProcess: (...args: unknown[]) => setJobProcessMock(...args),
    addOutput: (...args: unknown[]) => addOutputMock(...args),
    completeJob: (...args: unknown[]) => completeJobMock(...args),
    failJob: (...args: unknown[]) => failJobMock(...args),
  },
}));

let queueHandlers: JobQueueHandlers | undefined;
vi.mock('$lib/server/jobs/jobQueue', () => ({
  jobQueue: {
    registerHandlers: (handlers: JobQueueHandlers) => {
      queueHandlers = handlers;
    },
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
const assertConfigMock = vi.fn();
vi.mock('$lib/server/jobs/configGuard', () => ({
  assertConfigFileSafeForExecution: () => assertConfigMock(),
  resetConfigGuardCache: vi.fn(),
}));

const { executeGalleryDlCommand, executeGalleryDlBatchCommand } =
  await import('$lib/server/jobs/commandExecutor');
const { ConfigExecutionBlockedError } = await import('$lib/server/validation/exec-policy');

const START_FAILURE_MESSAGE = 'gallery-dl could not be started. Check the server logs for details.';

function fakePty() {
  return {
    pid: 1234,
    onData: () => undefined,
    onExit: () => undefined,
    kill: vi.fn(),
  };
}

async function startImmediately(_url: string, payload: QueuedExecution): Promise<string> {
  await queueHandlers?.start('job-1', payload, Date.now());
  return 'job-1';
}

describe('commandExecutor: queueing and start failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createQueuedJobMock.mockImplementation(startImmediately);
    setJobProcessMock.mockResolvedValue(true);
    addOutputMock.mockResolvedValue(undefined);
    completeJobMock.mockResolvedValue(undefined);
    failJobMock.mockResolvedValue(undefined);
    getCookieFileForUrlMock.mockResolvedValue(null);
    assertConfigMock.mockResolvedValue(undefined);
  });

  test('queues a versioned payload tagged with the policy it was built under', async () => {
    createQueuedJobMock.mockResolvedValue('job-1');

    await executeGalleryDlCommand('https://example.com/x', ['--no-skip']);
    await executeGalleryDlBatchCommand(['https://a.test/1', 'https://a.test/2'], [], {
      cookieUrl: 'https://example.com/x',
    });

    expect(createQueuedJobMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/x',
      {
        version: 1,
        policy: 'restricted',
        kind: 'single',
        url: 'https://example.com/x',
        cliArgs: ['--no-skip'],
        options: undefined,
      },
      undefined,
    );
    expect(createQueuedJobMock).toHaveBeenNthCalledWith(
      2,
      'directlink batch',
      {
        version: 1,
        policy: 'restricted',
        kind: 'batch',
        url: 'directlink batch',
        urls: ['https://a.test/1', 'https://a.test/2'],
        cliArgs: [],
        options: { cookieUrl: 'https://example.com/x' },
      },
      2,
    );
  });

  test('executeGalleryDlCommand: a throwing spawn fails the job with an explanatory output line', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    const result = await executeGalleryDlCommand('https://example.com/x', []);

    expect(result).toEqual({ success: true, jobId: 'job-1', status: 'running' });
    expect(failJobMock).toHaveBeenCalledWith('job-1', START_FAILURE_MESSAGE);
  });

  test('a config blocked at start time fails the job with the client-safe message', async () => {
    const blocked = new ConfigExecutionBlockedError('internal detail', 'Config is blocked.', []);
    assertConfigMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(blocked);

    await executeGalleryDlCommand('https://example.com/x', []);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(failJobMock).toHaveBeenCalledWith('job-1', 'Config is blocked.');
  });

  test('executeGalleryDlCommand: the success path never fails or completes the job', async () => {
    spawnMock.mockImplementation(() => fakePty());

    const result = await executeGalleryDlCommand('https://example.com/x', []);

    expect(result).toEqual({ success: true, jobId: 'job-1', status: 'running' });
    expect(failJobMock).not.toHaveBeenCalled();
    expect(completeJobMock).not.toHaveBeenCalled();
  });

  test('the job-start argv log redacts command-bearing option values', async () => {
    spawnMock.mockImplementation(() => fakePty());
    const sentinel = 'unique-job-start-log-sentinel-32b8';

    await executeGalleryDlCommand('https://example.com/x', [
      '--exec',
      sentinel,
      '--exec-after',
      sentinel,
    ]);

    const logged = JSON.stringify(loggerInfoMock.mock.calls);
    expect(logged).toContain('[REDACTED]');
    expect(logged).not.toContain(sentinel);
  });

  test('a failure while queueing reports an error and starts nothing', async () => {
    createQueuedJobMock.mockRejectedValue(new Error('db unavailable'));

    const result = await executeGalleryDlCommand('https://example.com/x', []);

    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(failJobMock).not.toHaveBeenCalled();
  });

  test('a job deleted while starting has its process killed', async () => {
    const pty = fakePty();
    spawnMock.mockImplementation(() => pty);
    setJobProcessMock.mockResolvedValue(false);

    await executeGalleryDlCommand('https://example.com/x', []);

    expect(pty.kill).toHaveBeenCalledTimes(1);
    expect(addOutputMock).not.toHaveBeenCalled();
  });

  test('executeGalleryDlBatchCommand: a throwing spawn fails the job with an explanatory output line', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    const result = await executeGalleryDlBatchCommand(['https://example.com/x'], []);

    expect(result).toEqual({ success: true, jobId: 'job-1', status: 'running' });
    expect(failJobMock).toHaveBeenCalledWith('job-1', START_FAILURE_MESSAGE);
  });

  test('executeGalleryDlBatchCommand: the success path never fails or completes the job', async () => {
    spawnMock.mockImplementation(() => fakePty());

    const result = await executeGalleryDlBatchCommand(['https://example.com/x'], []);

    expect(result).toEqual({ success: true, jobId: 'job-1', status: 'running' });
    expect(failJobMock).not.toHaveBeenCalled();
    expect(completeJobMock).not.toHaveBeenCalled();
  });
});
