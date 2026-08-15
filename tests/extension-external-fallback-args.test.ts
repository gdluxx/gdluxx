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

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

function fallbackOptionsFromCall(callIndex: number): GalleryDlCommandOptions | undefined {
  return executeGalleryDlCommandMock.mock.calls[callIndex][2] as
    | GalleryDlCommandOptions
    | undefined;
}

describe('extension external route: fallback batch inherits site-config CLI args', () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('case 1: site-config CLI options propagate into the fallback batch (regression for the bug)', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';
    getCliOptionsForUrlMock.mockResolvedValue([
      ['retries', 5],
      ['sleep', '2-4'],
    ]);

    const response = await POST({
      request: extRequest({ urls: [pageUrl], fallbackUrls: [cdnUrl] }),
    } as never);

    expect(response.status).toBe(200);
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
    const fallback = fallbackOptionsFromCall(0);
    expect(fallback?.fallbackUrls).toEqual([cdnUrl]);
    expect(fallback?.fallbackCliArgs).toEqual(['--retries', '5', '--sleep', '2-4']);
  });

  test('case 2: a wildcard (*) site-config match also propagates to the fallback', async () => {
    const pageUrl = 'https://some-random-host.example/gallery/abc';
    const cdnUrl = 'https://cdn.other-provider.net/vid.mp4';

    getCliOptionsForUrlMock.mockResolvedValue([
      ['retries', 5],
      ['sleep', '2-4'],
    ]);

    await POST({
      request: extRequest({ urls: [pageUrl], fallbackUrls: [cdnUrl] }),
    } as never);

    const fallback = fallbackOptionsFromCall(0);
    expect(fallback?.fallbackCliArgs).toEqual(['--retries', '5', '--sleep', '2-4']);
  });

  test('case 3: directory args are present in the fallback and ordered after site options', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';
    getCliOptionsForUrlMock.mockResolvedValue([['retries', 3]]);

    await POST({
      request: extRequest({
        urls: [pageUrl],
        fallbackUrls: [cdnUrl],
        siteDirectory: 'example.com',
      }),
    } as never);

    const fallback = fallbackOptionsFromCall(0);
    expect(fallback?.fallbackCliArgs).toEqual([
      '--retries',
      '3',
      '-o',
      'directory=["example.com"]',
    ]);
  });

  test('case 4: no site-config match leaves the fallback with directory args only', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';
    getCliOptionsForUrlMock.mockResolvedValue([]);

    await POST({
      request: extRequest({
        urls: [pageUrl],
        fallbackUrls: [cdnUrl],
        siteDirectory: 'example.com',
      }),
    } as never);

    const fallback = fallbackOptionsFromCall(0);
    expect(fallback?.fallbackCliArgs).toEqual(['-o', 'directory=["example.com"]']);
  });

  test('case 5: precedence pin — site config -o pair comes before the request-supplied -o pair', async () => {
    const pageUrl = 'https://example.com/gallery/123';
    const cdnUrl = 'https://cdn.example.com/img.jpg';
    getCliOptionsForUrlMock.mockResolvedValue([['option', 'directory=should-not-win']]);

    await POST({
      request: extRequest({
        urls: [pageUrl],
        fallbackUrls: [cdnUrl],
        siteDirectory: 'example.com',
      }),
    } as never);

    const fallback = fallbackOptionsFromCall(0);
    const args = fallback?.fallbackCliArgs ?? [];
    const siteOptionIndex = args.indexOf('--option');
    const requestDirIndex = args.indexOf('-o');
    expect(siteOptionIndex).toBeGreaterThanOrEqual(0);
    expect(requestDirIndex).toBeGreaterThan(siteOptionIndex);
    expect(args).toEqual([
      '--option',
      'directory=should-not-win',
      '-o',
      'directory=["example.com"]',
    ]);
  });

  test('case 6: multi-URL requests discard the fallback entirely (fallbackOptions is undefined)', async () => {
    const urlA = 'https://a.example.com/gallery/1';
    const urlB = 'https://b.example.com/gallery/2';
    getCliOptionsForUrlMock.mockResolvedValue([]);

    await POST({
      request: extRequest({
        urls: [urlA, urlB],
        fallbackUrls: ['https://cdn.example.com/x.jpg'],
      }),
    } as never);

    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(2);
    expect(fallbackOptionsFromCall(0)).toBeUndefined();
    expect(fallbackOptionsFromCall(1)).toBeUndefined();
  });

  test('case 7: the lone direct-media-URL branch is intentionally unchanged (directory args only, no site-config lookup)', async () => {
    const directUrl = 'https://cdn.example.com/img.jpg';
    const otherCdnUrl = 'https://other-cdn.example.com/y.jpg';

    await POST({
      request: extRequest({
        urls: [directUrl],
        fallbackUrls: [otherCdnUrl],
        siteDirectory: 'example.com',
      }),
    } as never);

    expect(getCliOptionsForUrlMock).not.toHaveBeenCalled();
    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
    const fallback = fallbackOptionsFromCall(0);
    expect(fallback?.fallbackCliArgs).toEqual(['-o', 'directory=["example.com"]']);
  });
});
