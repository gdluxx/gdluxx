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
 * Guards removal of the subprocess-spawning `GET /api/command/stream?url=`
 * route, which accepted an attacker-controlled URL, while retaining the
 * job-scoped subscription route.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RequestHandler } from '@sveltejs/kit';

const getJobMock = vi.fn();
vi.mock('$lib/server/jobs/jobManager', () => ({
  jobManager: {
    getJob: (...args: unknown[]) => getJobMock(...args),
    addSubscriber: vi.fn(),
    removeSubscriber: vi.fn(),
  },
}));

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { GET } = await import('../src/routes/api/command/stream/[jobId]/+server');

function requestEvent(
  params: Record<string, string>,
  request: Request,
): Parameters<RequestHandler>[0] {
  return {
    params,
    request,
    locals: { user: { id: 'test-user' } },
  } as Parameters<RequestHandler>[0];
}

describe('REM-007: dead SSRF-spawning command/stream GET route', () => {
  test('REM-007: src/routes/api/command/stream/+server.ts no longer exists', () => {
    const routePath = fileURLToPath(
      new URL('../src/routes/api/command/stream/+server.ts', import.meta.url),
    );
    expect(existsSync(routePath)).toBe(false);
  });
});

describe('GET /api/command/stream/[jobId] (retained live-output subscription)', () => {
  beforeEach(() => {
    getJobMock.mockReset();
  });

  test('400s when params.jobId is missing', async () => {
    const response = await GET(requestEvent({}, new Request('http://localhost/')));

    expect(response.status).toBe(400);
    expect(getJobMock).not.toHaveBeenCalled();
  });

  test('404s when the job is unknown', async () => {
    getJobMock.mockResolvedValueOnce(undefined);

    const response = await GET(
      requestEvent({ jobId: 'missing-job' }, new Request('http://localhost/')),
    );

    expect(response.status).toBe(404);
    expect(getJobMock).toHaveBeenCalledWith('missing-job');
  });
});
