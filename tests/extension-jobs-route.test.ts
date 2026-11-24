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
import type { JobListItem } from '$lib/types/jobs';

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const validateApiKeyMock = vi.fn();
vi.mock('$lib/server/auth/apiAuth', () => ({
  validateApiKey: (...args: unknown[]) => validateApiKeyMock(...args),
}));

const readJobsByIdsMock = vi.fn();
vi.mock('$lib/server/jobs/jobsManager', () => ({
  readJobsByIds: (...args: unknown[]) => readJobsByIdsMock(...args),
}));

const { GET } = await import('../src/routes/api/extension/jobs/+server');

function job(id: string, status: JobListItem['status']): JobListItem {
  return {
    id,
    url: `https://example.test/${id}`,
    status,
    startTime: 1,
    downloadCount: 0,
    skipCount: 0,
    retryable: false,
  };
}

function request(ids: string, authorization = 'Bearer test-key') {
  return {
    request: new Request(`http://localhost/api/extension/jobs?ids=${ids}`, {
      headers: { authorization },
    }),
    url: new URL(`http://localhost/api/extension/jobs?ids=${ids}`),
  } as Parameters<typeof GET>[0];
}

describe('GET /api/extension/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateApiKeyMock.mockResolvedValue({ success: true, keyInfo: { id: 'key-1', name: 'k' } });
  });

  test('reports a queued job as running, since the extension treats any other status as finished', async () => {
    readJobsByIdsMock.mockReturnValue([job('queued', 'waiting'), job('done', 'success')]);

    const response = await GET(request('queued,done'));
    const body = await response.json();

    expect(body.data.jobs.map((item: JobListItem) => [item.id, item.status])).toEqual([
      ['queued', 'running'],
      ['done', 'success'],
    ]);
  });

  test('still requires a Bearer token', async () => {
    const response = await GET(request('queued', ''));

    expect(response.status).toBe(401);
    expect(readJobsByIdsMock).not.toHaveBeenCalled();
  });
});
