/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { GalleryDlCommandOptions } from '$lib/server/jobs/commandExecutor';

vi.mock('$app/environment', () => ({
  dev: false,
  building: false,
  browser: false,
  version: 'test',
}));

const loggerWarnMock = vi.fn();
const loggerInfoMock = vi.fn();
vi.mock('$lib/server/logger', () => ({
  serverLogger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const getUserSettingsMock = vi.fn((_userId: string) => ({ maxBatchUrls: 200 }));
vi.mock('$lib/server/userSettingsManager', () => ({
  userSettingsManager: { getUserSettings: (userId: string) => getUserSettingsMock(userId) },
}));

const validateApiKeyMock = vi.fn();
vi.mock('$lib/server/auth/apiAuth', () => ({
  validateApiKey: (...args: unknown[]) => validateApiKeyMock(...args),
}));

const getCliOptionsForUrlMock = vi.fn();
vi.mock('$lib/server/siteConfigManager', () => ({
  siteConfigManager: {
    getCliOptionsForUrl: (...args: unknown[]) => getCliOptionsForUrlMock(...args),
  },
}));

const executeGalleryDlCommandMock = vi.fn();
const executeGalleryDlBatchCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
  executeGalleryDlBatchCommand: (...args: unknown[]) => executeGalleryDlBatchCommandMock(...args),
}));

const { POST } = await import('../src/routes/api/extension/external/+server');

const VALID_KEY_INFO = {
  id: 'key-1',
  name: 'Test Key',
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'user-1',
};

function extRequest(body: unknown): Request {
  return new Request('http://localhost/api/extension/external', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer good-key' },
    body: JSON.stringify(body),
  });
}

async function readEnvelope(response: Response) {
  return (await response.json()) as { success: boolean; error?: string };
}

function fallbackOptionsFromCall(callIndex: number): GalleryDlCommandOptions | undefined {
  return executeGalleryDlCommandMock.mock.calls[callIndex][2] as
    | GalleryDlCommandOptions
    | undefined;
}

describe('extension external route: single-URL fallback gate, diagnostics, and schema rejection', () => {
  beforeEach(() => {
    validateApiKeyMock.mockReset();
    validateApiKeyMock.mockResolvedValue({ success: true, keyInfo: VALID_KEY_INFO });
    getUserSettingsMock.mockClear();
    getCliOptionsForUrlMock.mockReset();
    getCliOptionsForUrlMock.mockResolvedValue([]);
    executeGalleryDlCommandMock.mockReset();
    executeGalleryDlCommandMock.mockResolvedValue({ success: true, jobId: 'job-1' });
    executeGalleryDlBatchCommandMock.mockReset();
    executeGalleryDlBatchCommandMock.mockResolvedValue({ success: true, jobId: 'job-batch' });
    loggerWarnMock.mockClear();
    loggerInfoMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('multi-URL request with fallbackUrls logs a "Discarding" warning (the single-URL gate)', async () => {
    const urlA = 'https://a.example.com/gallery/1';
    const urlB = 'https://b.example.com/gallery/2';

    await POST({
      request: extRequest({
        urls: [urlA, urlB],
        fallbackUrls: ['https://cdn.example.com/x.jpg'],
      }),
    } as never);

    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('Discarding'));
  });

  test('single-URL request with no fallbackUrls field: fallbackOptions is still built, with an empty fallbackUrls array and a diagnostic', async () => {
    const pageUrl = 'https://gallery.test/x';

    const response = await POST({
      request: extRequest({ urlToProcess: pageUrl }),
    } as never);

    expect(response.status).toBe(200);
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
    const fallback = fallbackOptionsFromCall(0);
    expect(fallback).toEqual({
      fallbackUrls: [],
      fallbackCliArgs: [],
      fallbackDiagnostic: 'extension did not send a fallbackUrls field',
    });

    expect(loggerWarnMock).not.toHaveBeenCalledWith(
      expect.stringContaining('fallbackUrls normalization'),
    );
  });

  test('single-URL request whose only fallbackUrls entry fails URL-shape normalization: empty fallbackUrls, allLost diagnostic, and a warn log', async () => {
    const pageUrl = 'https://gallery.test/x';

    const response = await POST({
      request: extRequest({ urlToProcess: pageUrl, fallbackUrls: ['not-a-url'] }),
    } as never);

    expect(response.status).toBe(200);
    const fallback = fallbackOptionsFromCall(0);
    expect(fallback?.fallbackUrls).toEqual([]);
    expect(fallback?.fallbackDiagnostic).toContain('all were removed by normalization');
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('fallbackUrls normalization'),
    );
  });

  test('a bare-string (non-array) fallbackUrls fails schema validation and 400s before any job starts', async () => {
    const response = await POST({
      request: extRequest({
        urlToProcess: 'https://gallery.test/x',
        fallbackUrls: 'https://cdn.test/1.jpg',
      }),
    } as never);

    expect(response.status).toBe(400);
    const envelope = await readEnvelope(response);
    expect(envelope.success).toBe(false);
    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
  });

  test('a fallbackUrls array over the schema cap fails schema validation and 400s before any job starts', async () => {
    // API_LIMITS.MAX_BATCH_URLS is 10000, have to remember to update this accordingly
    const tooMany = Array.from({ length: 10001 }, (_, i) => `https://cdn.test/${i}.jpg`);

    const response = await POST({
      request: extRequest({
        urlToProcess: 'https://gallery.test/x',
        fallbackUrls: tooMany,
      }),
    } as never);

    expect(response.status).toBe(400);
    const envelope = await readEnvelope(response);
    expect(envelope.success).toBe(false);
    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
  });
});
