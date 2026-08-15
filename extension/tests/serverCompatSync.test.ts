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
import { getMockBrowser, resetMockBrowser } from './support/mockBrowser';
import { computeFingerprint } from '#src/shared/serverCompat';

const proxyPingMock = vi.fn();

vi.mock('#src/background/apiProxy', async () => {
  const actual = await vi.importActual<typeof import('#src/background/apiProxy')>(
    '#src/background/apiProxy',
  );
  return {
    ...actual,
    proxyPing: (...args: unknown[]) => proxyPingMock(...args),
  };
});

const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';
const SERVER_COMPAT_KEY = 'gdluxx_server_compat';

// Must match STALE_COMPAT_TTL_MS in src/background/serverCompatSync.ts.
const STALE_TTL_MS = 5 * 60 * 60 * 1000;

const SERVER_URL = 'https://gdluxx.example';
const API_KEY = 'test-api-key';

async function loadServerCompatSync() {
  vi.resetModules();
  return import('#src/background/serverCompatSync');
}

async function setCredentials(): Promise<void> {
  await getMockBrowser().storage.local.set({
    [SERVER_URL_KEY]: SERVER_URL,
    [API_KEY_KEY]: API_KEY,
  });
}

async function seedCompat(overrides: Record<string, unknown> = {}): Promise<void> {
  const fingerprint = computeFingerprint(SERVER_URL, API_KEY);
  const now = Date.now();
  await getMockBrowser().storage.local.set({
    [SERVER_COMPAT_KEY]: {
      fingerprint,
      serverVersion: '0.11.0',
      protocolVersion: 1,
      capabilities: [],
      pingedAt: now,
      checkedAt: now,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await resetMockBrowser();
  proxyPingMock.mockReset();
  proxyPingMock.mockResolvedValue({
    success: true,
    data: { serverVersion: '0.13.0', protocolVersion: 1, capabilities: [] },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ensureFreshCompat', () => {
  test('no compat record at all, credentials configured -> pings (nothing to be fresh against)', async () => {
    await setCredentials();
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('pingedAt recent (within TTL) -> does not ping', async () => {
    await setCredentials();
    await seedCompat({ pingedAt: Date.now(), checkedAt: Date.now() });
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).not.toHaveBeenCalled();
  });

  test('regression: pingedAt stale but checkedAt very recent (a scheduled ping just failed) -> still pings', async () => {
    await setCredentials();
    await seedCompat({
      pingedAt: Date.now() - STALE_TTL_MS - 1,
      checkedAt: Date.now(),
    });
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('isolation: pingedAt recent, checkedAt very old -> still does not ping', async () => {
    await setCredentials();
    await seedCompat({
      pingedAt: Date.now(),
      checkedAt: Date.now() - STALE_TTL_MS - 1,
    });
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).not.toHaveBeenCalled();
  });

  test('never successfully pinged, but recently attempted -> pings', async () => {
    await setCredentials();
    await seedCompat({ pingedAt: null, checkedAt: Date.now() });
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('legacy record missing pingedAt entirely -> treated as infinitely stale, pings', async () => {
    await setCredentials();
    const fingerprint = computeFingerprint(SERVER_URL, API_KEY);
    await getMockBrowser().storage.local.set({
      [SERVER_COMPAT_KEY]: {
        fingerprint,
        serverVersion: '0.10.0',
        protocolVersion: null,
        capabilities: [],
        checkedAt: Date.now(),
      },
    });
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('end-to-end regression via the real write path: a failed ping does not defer the next retry', async () => {
    await setCredentials();
    vi.useFakeTimers();

    const { recordPingSuccess, recordPingFailure } = await import('#src/shared/serverCompat');
    const { ensureFreshCompat } = await loadServerCompatSync();
    const fingerprint = computeFingerprint(SERVER_URL, API_KEY);

    await recordPingSuccess(fingerprint, { capabilities: [] }); // pingedAt = T0
    await vi.advanceTimersByTimeAsync(60_000); // 1 minute later
    await recordPingFailure(fingerprint); // checkedAt = T1 > T0, pingedAt still T0

    await vi.advanceTimersByTimeAsync(STALE_TTL_MS - 30_000);

    await ensureFreshCompat();

    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('no credentials configured -> does not ping regardless of pingedAt/checkedAt', async () => {
    await seedCompat({
      pingedAt: Date.now() - STALE_TTL_MS - 1,
      checkedAt: Date.now() - STALE_TTL_MS - 1,
    });
    const { ensureFreshCompat } = await loadServerCompatSync();

    await ensureFreshCompat();

    expect(proxyPingMock).not.toHaveBeenCalled();
  });
});
