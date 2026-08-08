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
import { getMockBrowser, resetMockBrowser } from './support/mockBrowser';

const proxyJobsGetMock = vi.fn();
const corroborateAndMarkAbsentMock = vi.fn();

vi.mock('#src/background/apiProxy', async () => {
  const actual = await vi.importActual<typeof import('#src/background/apiProxy')>(
    '#src/background/apiProxy',
  );
  return {
    ...actual,
    proxyJobsGet: (...args: unknown[]) => proxyJobsGetMock(...args),
  };
});

vi.mock('#src/background/serverCompatSync', () => ({
  corroborateAndMarkAbsent: (...args: unknown[]) => corroborateAndMarkAbsentMock(...args),
}));

const PENDING_KEY = 'gdluxx_pending_jobs';
const RESULTS_KEY = 'gdluxx_job_results';
const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';
const ALARM_NAME = 'gdluxx-jobs-poll';
const UNSUPPORTED_NOTIFICATION_ID = 'gdluxx-jobs-unsupported';
const SERVER_COMPAT_KEY = 'gdluxx_server_compat';

function jobsPollingKnownAbsentCompat(): Record<string, unknown> {
  return {
    fingerprint: 'test-fingerprint',
    serverVersion: '0.11.0',
    protocolVersion: null,
    capabilities: [],
    pingedAt: Date.now(),
    checkedAt: Date.now(),
  };
}

interface PendingBatch {
  batchId: string;
  createdAt: number;
  updatedAt: number;
  sealed?: boolean;
  jobs: Array<{ jobId: string; url: string }>;
}

async function loadJobTracker() {
  vi.resetModules();
  return import('#src/background/jobTracker');
}

async function seedOnePendingBatch(): Promise<void> {
  const browser = getMockBrowser();
  const now = Date.now();
  const batch: PendingBatch = {
    batchId: 'batch-1',
    createdAt: now,
    updatedAt: now,
    sealed: true,
    jobs: [{ jobId: 'job-1', url: 'https://example.com/a' }],
  };
  await browser.storage.local.set({
    [PENDING_KEY]: [batch],
    [SERVER_URL_KEY]: 'https://gdluxx.example',
    [API_KEY_KEY]: 'test-api-key',
  });
}

beforeEach(async () => {
  await resetMockBrowser();
  proxyJobsGetMock.mockReset();
  corroborateAndMarkAbsentMock.mockReset();
  proxyJobsGetMock.mockResolvedValue({ success: false, status: 404, error: 'Server error: 404' });
});

describe('handleJobsAlarm bail-out (endpoint-absent + corroborated)', () => {
  test('ping-confirms-absent: batches resolve untracked, alarm clears, capability gets marked', async () => {
    await seedOnePendingBatch();
    corroborateAndMarkAbsentMock.mockResolvedValue('confirmed-absent');
    const browser = getMockBrowser();

    const { handleJobsAlarm } = await loadJobTracker();
    await handleJobsAlarm();

    expect(corroborateAndMarkAbsentMock).toHaveBeenCalledTimes(1);
    expect(corroborateAndMarkAbsentMock).toHaveBeenCalledWith(
      'jobs.polling',
      'https://gdluxx.example',
      'test-api-key',
    );

    const stored = await browser.storage.local.get([PENDING_KEY, RESULTS_KEY]);
    expect(stored[PENDING_KEY]).toEqual([]);
    expect(stored[RESULTS_KEY]).toEqual([
      expect.objectContaining({
        jobId: 'job-1',
        url: 'https://example.com/a',
        status: 'untracked',
        batchId: 'batch-1',
      }),
    ]);

    expect(browser.alarms.clear).toHaveBeenCalledWith(ALARM_NAME);
    expect(browser.notifications.create).toHaveBeenCalledWith(
      UNSUPPORTED_NOTIFICATION_ID,
      expect.objectContaining({
        message: expect.stringContaining('does not support job tracking'),
      }),
    );
  });

  test('ping-fails: treated as transient, batches are left pending, no bail-out notification', async () => {
    await seedOnePendingBatch();
    corroborateAndMarkAbsentMock.mockResolvedValue('transient');
    const browser = getMockBrowser();

    const { handleJobsAlarm } = await loadJobTracker();
    await handleJobsAlarm();

    expect(corroborateAndMarkAbsentMock).toHaveBeenCalledTimes(1);

    const stored = await browser.storage.local.get([PENDING_KEY, RESULTS_KEY]);
    const pending = stored[PENDING_KEY] as PendingBatch[];
    expect(pending).toHaveLength(1);
    expect(pending[0].batchId).toBe('batch-1');
    expect(pending[0].jobs).toEqual([{ jobId: 'job-1', url: 'https://example.com/a' }]);
    expect(stored[RESULTS_KEY] ?? []).toEqual([]);

    expect(browser.alarms.clear).not.toHaveBeenCalledWith(ALARM_NAME);
    expect(browser.notifications.create).not.toHaveBeenCalledWith(
      UNSUPPORTED_NOTIFICATION_ID,
      expect.anything(),
    );
  });

  test('only one corroborating ping fires per tick even if corroboration is ambiguous', async () => {
    await seedOnePendingBatch();
    corroborateAndMarkAbsentMock.mockResolvedValue('transient');

    const { handleJobsAlarm } = await loadJobTracker();
    await handleJobsAlarm();

    expect(corroborateAndMarkAbsentMock).toHaveBeenCalledTimes(1);
  });
});

describe('handleJobsAlarm bail-out (jobs.polling already known-absent)', () => {
  test('bails out via bailOutJobsPolling with no jobs fetch and no corroborating ping', async () => {
    await seedOnePendingBatch();
    const browser = getMockBrowser();
    await browser.storage.local.set({ [SERVER_COMPAT_KEY]: jobsPollingKnownAbsentCompat() });

    const { handleJobsAlarm } = await loadJobTracker();
    await handleJobsAlarm();

    expect(proxyJobsGetMock).not.toHaveBeenCalled();
    expect(corroborateAndMarkAbsentMock).not.toHaveBeenCalled();

    const stored = await browser.storage.local.get([PENDING_KEY, RESULTS_KEY]);
    expect(stored[PENDING_KEY]).toEqual([]);
    expect(stored[RESULTS_KEY]).toEqual([
      expect.objectContaining({
        jobId: 'job-1',
        url: 'https://example.com/a',
        status: 'untracked',
        batchId: 'batch-1',
      }),
    ]);
    expect(browser.alarms.clear).toHaveBeenCalledWith(ALARM_NAME);
    expect(browser.notifications.create).toHaveBeenCalledWith(
      UNSUPPORTED_NOTIFICATION_ID,
      expect.objectContaining({
        message: expect.stringContaining('does not support job tracking'),
      }),
    );
  });
});

describe('recordPendingBatch when jobs.polling is already known-absent', () => {
  test('writes terminal untracked results directly, without ever creating a pending batch or alarm', async () => {
    const browser = getMockBrowser();
    await browser.storage.local.set({ [SERVER_COMPAT_KEY]: jobsPollingKnownAbsentCompat() });

    const { recordPendingBatch } = await loadJobTracker();
    await recordPendingBatch(
      [{ jobId: 'job-9', url: 'https://example.com/z', success: true }],
      'https://example.com/z',
      undefined,
      ['https://example.com/z'],
      true,
    );

    const stored = await browser.storage.local.get([PENDING_KEY, RESULTS_KEY]);
    expect(stored[PENDING_KEY] ?? []).toEqual([]);
    expect(stored[RESULTS_KEY]).toEqual([
      expect.objectContaining({
        jobId: 'job-9',
        url: 'https://example.com/z',
        status: 'untracked',
      }),
    ]);
    expect(browser.alarms.create).not.toHaveBeenCalled();
  });

  test('a result with no jobId is a no-op (nothing to resolve, nothing written)', async () => {
    const browser = getMockBrowser();
    await browser.storage.local.set({ [SERVER_COMPAT_KEY]: jobsPollingKnownAbsentCompat() });

    const { recordPendingBatch } = await loadJobTracker();
    await recordPendingBatch(
      [{ url: 'https://example.com/no-job-id', success: false, error: 'rejected' }],
      undefined,
      undefined,
      ['https://example.com/no-job-id'],
      true,
    );

    const stored = await browser.storage.local.get([PENDING_KEY, RESULTS_KEY]);
    expect(stored[PENDING_KEY] ?? []).toEqual([]);
    expect(stored[RESULTS_KEY] ?? []).toEqual([]);
  });
});
