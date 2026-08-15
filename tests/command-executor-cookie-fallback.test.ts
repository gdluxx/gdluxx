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

const { executeGalleryDlCommand, executeGalleryDlBatchCommand } =
  await import('$lib/server/jobs/commandExecutor');

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

function batchProcessArgs(callIndex: number): string[] {
  return spawnMock.mock.calls[callIndex][1] as string[];
}

describe('cookie resolution for the direct-link fallback batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exitHandlers = [];
    jobCounter = 0;
    createJobMock.mockImplementation(async () => `job-${++jobCounter}`);
    createBatchJobMock.mockImplementation(async () => `job-${++jobCounter}`);
    setJobProcessMock.mockResolvedValue(undefined);
    addOutputMock.mockResolvedValue(undefined);
    completeJobMock.mockResolvedValue(undefined);
    getCookieFileForUrlMock.mockReset();
    spawnMock.mockImplementation(() => fakePty());
  });

  test('regression: page URL cookie match wins even though CDN url[0] has no match', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn-assets.other-provider.net/img.jpg';
    const pageCookieFile = '/data/cookies/example.com.txt';

    getCookieFileForUrlMock.mockImplementation(async (url: string) =>
      url === pageUrl ? pageCookieFile : null,
    );

    await executeGalleryDlCommand(pageUrl, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    expect(exitHandlers).toHaveLength(1);
    getCookieFileForUrlMock.mockClear();
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(batchProcessArgs(1)).toEqual(expect.arrayContaining(['--cookies', pageCookieFile]));
    expect(getCookieFileForUrlMock).toHaveBeenCalledTimes(1);
    expect(getCookieFileForUrlMock).toHaveBeenCalledWith(pageUrl);
  });

  test('secondary CDN-host fallback: page URL has no match, CDN URL does', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn-assets.other-provider.net/img.jpg';
    const cdnCookieFile = '/data/cookies/cdn-assets.other-provider.net.txt';

    getCookieFileForUrlMock.mockImplementation(async (url: string) =>
      url === cdnUrl ? cdnCookieFile : null,
    );

    await executeGalleryDlCommand(pageUrl, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    getCookieFileForUrlMock.mockClear();
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(batchProcessArgs(1)).toEqual(expect.arrayContaining(['--cookies', cdnCookieFile]));
    expect(getCookieFileForUrlMock).toHaveBeenNthCalledWith(1, pageUrl);
    expect(getCookieFileForUrlMock).toHaveBeenNthCalledWith(2, cdnUrl);
  });

  test('neither page URL nor CDN URL has a cookie match: no --cookies flag added', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn-assets.other-provider.net/img.jpg';

    getCookieFileForUrlMock.mockResolvedValue(null);

    await executeGalleryDlCommand(pageUrl, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: [],
    });
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(batchProcessArgs(1)).not.toContain('--cookies');
  });

  test('--cookies override in fallbackCliArgs short-circuits cookie lookup', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn-assets.other-provider.net/img.jpg';
    const overrideArgs = ['--cookies', 'somefile.txt'];

    await executeGalleryDlCommand(pageUrl, [], {
      fallbackUrls: [cdnUrl],
      fallbackCliArgs: overrideArgs,
    });
    getCookieFileForUrlMock.mockClear();
    await exitHandlers[0]({ exitCode: UNSUPPORTED_URL_EXIT });

    expect(getCookieFileForUrlMock).not.toHaveBeenCalled();
    expect(batchProcessArgs(1).slice(0, overrideArgs.length)).toEqual(overrideArgs);
  });

  test('backward compatibility: caller with no third argument resolves cookies from urls[0] only', async () => {
    const urlA = 'https://cdn1.example.net/a.jpg';
    const urlB = 'https://cdn1.example.net/b.jpg';
    const cookieFile = '/data/cookies/cdn1.example.net.txt';
    getCookieFileForUrlMock.mockResolvedValue(cookieFile);

    const result = await executeGalleryDlBatchCommand([urlA, urlB], []);

    expect(result.success).toBe(true);
    expect(getCookieFileForUrlMock).toHaveBeenCalledTimes(1);
    expect(getCookieFileForUrlMock).toHaveBeenCalledWith(urlA);
    expect(batchProcessArgs(0)).toEqual(expect.arrayContaining(['--cookies', cookieFile]));
  });

  test('dedup: cookieUrl equal to urls[0] triggers only one lookup', async () => {
    const url = 'https://example.com/a.jpg';
    const cookieFile = '/data/cookies/example.com.txt';
    getCookieFileForUrlMock.mockResolvedValue(cookieFile);

    await executeGalleryDlBatchCommand([url], [], { cookieUrl: url });

    expect(getCookieFileForUrlMock).toHaveBeenCalledTimes(1);
    expect(getCookieFileForUrlMock).toHaveBeenCalledWith(url);
  });
});
