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

const { POST } = await import('../src/routes/api/extension/ping/+server');

const VALID_KEY_INFO = {
  id: 'key-1',
  name: 'Test Key',
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'user-1',
};

function pingRequest(init: { authorization?: string; body?: string; omitBody?: boolean } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.authorization !== undefined) {
    headers.authorization = init.authorization;
  }
  return new Request('http://localhost/api/extension/ping', {
    method: 'POST',
    headers,
    ...(init.omitBody ? {} : { body: init.body ?? '' }),
  });
}

async function readEnvelope(response: Response) {
  return (await response.json()) as {
    success: boolean;
    error?: string;
    data?: {
      message?: string;
      keyId?: string;
      keyName?: string;
      maxBatchUrls?: number;
      serverVersion?: string;
      protocolVersion?: number;
      capabilities?: string[];
    };
  };
}

describe('extension ping route', () => {
  beforeEach(() => {
    validateApiKeyMock.mockReset();
    getUserSettingsMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('missing Authorization header is rejected before any parsing', async () => {
    const response = await POST({ request: pingRequest({ omitBody: true }) } as never);
    expect(response.status).toBe(401);
    expect(validateApiKeyMock).not.toHaveBeenCalled();
  });

  test('empty Bearer token is rejected', async () => {
    const response = await POST({
      request: pingRequest({ authorization: 'Bearer  ' }),
    } as never);
    expect(response.status).toBe(400);
    expect(validateApiKeyMock).not.toHaveBeenCalled();
  });

  test('an invalid API key is rejected with 401', async () => {
    validateApiKeyMock.mockResolvedValue({ success: false, error: 'Invalid API key.' });
    const response = await POST({
      request: pingRequest({ authorization: 'Bearer bad-key', omitBody: true }),
    } as never);
    expect(response.status).toBe(401);
    const envelope = await readEnvelope(response);
    expect(envelope.success).toBe(false);
  });

  test('a valid key with a completely empty body still 200s (the parseJsonOptional regression guard)', async () => {
    validateApiKeyMock.mockResolvedValue({ success: true, keyInfo: VALID_KEY_INFO });
    const response = await POST({
      request: pingRequest({ authorization: 'Bearer good-key', omitBody: true }),
    } as never);

    expect(response.status).toBe(200);
    const envelope = await readEnvelope(response);
    expect(envelope.success).toBe(true);
    expect(envelope.data?.message).toBe('Connection successful!');
    expect(envelope.data?.keyId).toBe('key-1');
    expect(envelope.data?.keyName).toBe('Test Key');
    expect(envelope.data?.maxBatchUrls).toBe(200);
    expect(typeof envelope.data?.serverVersion).toBe('string');
    expect(envelope.data?.protocolVersion).toBe(1);
    expect(envelope.data?.capabilities).toEqual([
      'cookies.sync',
      'jobs.polling',
      'extraction.directorySource',
      'extraction.accumulate',
    ]);
  });

  test('a valid key with a valid {extensionVersion} body 200s the same way', async () => {
    validateApiKeyMock.mockResolvedValue({ success: true, keyInfo: VALID_KEY_INFO });
    const response = await POST({
      request: pingRequest({
        authorization: 'Bearer good-key',
        body: JSON.stringify({ extensionVersion: '1.6.0' }),
      }),
    } as never);

    expect(response.status).toBe(200);
    const envelope = await readEnvelope(response);
    expect(envelope.success).toBe(true);
    expect(envelope.data?.protocolVersion).toBe(1);
    expect(Array.isArray(envelope.data?.capabilities)).toBe(true);
  });

  test('malformed (non-empty, non-JSON) body is rejected with 400, not tolerated', async () => {
    validateApiKeyMock.mockResolvedValue({ success: true, keyInfo: VALID_KEY_INFO });
    const response = await POST({
      request: pingRequest({ authorization: 'Bearer good-key', body: '{not valid json' }),
    } as never);

    expect(response.status).toBe(400);
    expect(validateApiKeyMock).toHaveBeenCalled(); // auth still ran before body parsing
  });
});
