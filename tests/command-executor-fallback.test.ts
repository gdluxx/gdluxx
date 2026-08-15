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

const loggerWarnMock = vi.fn();
vi.mock('$lib/server/logger', () => ({
  serverLogger: {
    info: vi.fn(),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
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

const { executeGalleryDlCommand } = await import('$lib/server/jobs/commandExecutor');

interface ExitEvent {
  exitCode: number;
  signal?: number;
}
type ExitHandler = (event: ExitEvent) => void | Promise<void>;

let exitHandlers: ExitHandler[] = [];
let jobCounter = 0;

function noop(_data: string): void {
  // fake ipty's onData handler
}

function fakePty() {
  return {
    pid: 1234,
    onData: noop,
    onExit: (cb: ExitHandler) => {
      exitHandlers.push(cb);
    },
  };
}

const UNSUPPORTED_URL_EXIT = 64;

describe('commandExecutor arming condition (fallback batch trigger)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exitHandlers = [];
    jobCounter = 0;
    createJobMock.mockImplementation(async () => `job-${++jobCounter}`);
    createBatchJobMock.mockImplementation(async () => `job-${++jobCounter}`);
    setJobProcessMock.mockResolvedValue(undefined);
    addOutputMock.mockResolvedValue(undefined);
    completeJobMock.mockResolvedValue(undefined);
    getCookieFileForUrlMock.mockResolvedValue(null);
    spawnMock.mockImplementation(() => fakePty());
  });

  test('unsupported exit + non-empty fallbackUrls arms the batch: spawn is called a second time with the fallback URL', async () => {
    const url = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';

    await executeGalleryDlCommand(url, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(spawnMock).toHaveBeenCalledTimes(2);
    const secondCallArgs = spawnMock.mock.calls[1][1] as string[];
    expect(secondCallArgs).toContain(cdnUrl);
  });

  test('a supported (successful) exit does not arm the batch, even with fallbackUrls present', async () => {
    const url = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';

    await executeGalleryDlCommand(url, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    await exitHandlers[0]({ exitCode: 0 });

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test('a non-64 failure exit does not arm the batch, even with fallbackUrls present', async () => {
    const url = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';

    await executeGalleryDlCommand(url, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    await exitHandlers[0]({ exitCode: 1 });

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test('unsupported exit with no options at all (e.g. /api/command/start) does not arm the batch and does not warn', async () => {
    const url = 'https://example.com/gallery/123';

    await executeGalleryDlCommand(url, []);
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  test('unsupported exit with an empty fallbackUrls array does not arm the batch, but logs the fallbackDiagnostic warning', async () => {
    const url = 'https://example.com/gallery/123';

    await executeGalleryDlCommand(url, [], {
      fallbackUrls: [],
      fallbackCliArgs: [],
      fallbackDiagnostic:
        'extension sent an empty fallbackUrls array (no direct-link candidates found)',
    });
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('no fallback batch to run'),
    );
  });

  test('unsupported exit with an empty fallbackUrls array and no fallbackDiagnostic stays silent (no warn)', async () => {
    const url = 'https://example.com/gallery/123';

    await executeGalleryDlCommand(url, [], {
      fallbackUrls: [],
      fallbackCliArgs: [],
    });
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  test('successful arming: addOutput notifies both jobs, and completeJob still fires for the original job', async () => {
    const url = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';

    await executeGalleryDlCommand(url, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    const originalJobId = await createJobMock.mock.results[0]?.value;
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });
    const batchJobId = await createBatchJobMock.mock.results[0]?.value;

    expect(addOutputMock).toHaveBeenCalledWith(
      batchJobId,
      'info',
      expect.stringContaining(originalJobId),
    );
    expect(addOutputMock).toHaveBeenCalledWith(
      originalJobId,
      'info',
      expect.stringContaining(batchJobId),
    );
    expect(completeJobMock).toHaveBeenCalledWith(originalJobId, UNSUPPORTED_URL_EXIT);
  });
});
