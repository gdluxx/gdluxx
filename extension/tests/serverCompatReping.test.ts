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
const DEMAND_REPING_KEY = 'gdluxx_compat_reping';
const COOLDOWN_MS = 15 * 60 * 1000;

const SERVER_URL = 'https://gdluxx.example';
const API_KEY = 'test-api-key';
const FALLBACK_FLAG = 'external.fallbackUrls';

interface DemandRepingMarker {
  fingerprint: string;
  attemptedAt: number;
}

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

async function readMarker(): Promise<DemandRepingMarker | undefined> {
  const stored = await getMockBrowser().storage.local.get(DEMAND_REPING_KEY);
  return stored[DEMAND_REPING_KEY] as DemandRepingMarker | undefined;
}

async function seedCompat(capabilities: string[]): Promise<void> {
  const now = Date.now();
  await getMockBrowser().storage.local.set({
    [SERVER_COMPAT_KEY]: {
      fingerprint: computeFingerprint(SERVER_URL, API_KEY),
      serverVersion: '0.11.0',
      protocolVersion: 1,
      capabilities,
      pingedAt: now,
      checkedAt: now,
    },
  });
}

beforeEach(async () => {
  await resetMockBrowser();
  proxyPingMock.mockReset();
  proxyPingMock.mockResolvedValue({
    success: true,
    data: { serverVersion: '0.13.0', protocolVersion: 1, capabilities: [FALLBACK_FLAG] },
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('refreshCompatOnDemand', () => {
  test('no credentials configured is a silent no-op', async () => {
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const result = await refreshCompatOnDemand('overlay-open');

    expect(result).toEqual({ success: true, data: { pinged: false, throttled: false } });
    expect(proxyPingMock).not.toHaveBeenCalled();
    expect(await readMarker()).toBeUndefined();
  });

  test('first call pings and claims the cooldown marker for the current fingerprint', async () => {
    await setCredentials();
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const result = await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);

    expect(result).toEqual({ success: true, data: { pinged: true, throttled: false } });
    expect(proxyPingMock).toHaveBeenCalledTimes(1);
    expect(proxyPingMock).toHaveBeenCalledWith(SERVER_URL, API_KEY);

    const marker = await readMarker();
    expect(marker?.fingerprint).toBe(computeFingerprint(SERVER_URL, API_KEY));
    expect(typeof marker?.attemptedAt).toBe('number');
  });

  test('a successful ping updates the capability record the caller re-reads', async () => {
    await setCredentials();
    await seedCompat([]);
    const { refreshCompatOnDemand } = await loadServerCompatSync();
    const { getServerCompat, isBlocked } = await import('#src/shared/serverCompat');

    await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);

    expect(isBlocked(await getServerCompat(), FALLBACK_FLAG)).toBe(false);
  });

  test('an immediate second call is throttled and does not ping again', async () => {
    await setCredentials();
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);
    const second = await refreshCompatOnDemand('overlay-open');

    expect(second).toEqual({ success: true, data: { pinged: false, throttled: true } });
    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('a marker for a different fingerprint does not throttle', async () => {
    await setCredentials();
    await getMockBrowser().storage.local.set({
      [DEMAND_REPING_KEY]: { fingerprint: 'deadbeef', attemptedAt: Date.now() },
    });
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const result = await refreshCompatOnDemand('overlay-open');

    expect(result.data).toEqual({ pinged: true, throttled: false });
    expect(proxyPingMock).toHaveBeenCalledTimes(1);
    expect((await readMarker())?.fingerprint).toBe(computeFingerprint(SERVER_URL, API_KEY));
  });

  test('a marker older than the cooldown pings again', async () => {
    await setCredentials();
    await getMockBrowser().storage.local.set({
      [DEMAND_REPING_KEY]: {
        fingerprint: computeFingerprint(SERVER_URL, API_KEY),
        attemptedAt: Date.now() - (COOLDOWN_MS + 60_000),
      },
    });
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const result = await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);

    expect(result.data).toEqual({ pinged: true, throttled: false });
    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('a flag that already reads yes needs no correction', async () => {
    await setCredentials();
    await seedCompat([FALLBACK_FLAG]);
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const result = await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);

    expect(result).toEqual({ success: true, data: { pinged: false, throttled: false } });
    expect(proxyPingMock).not.toHaveBeenCalled();
    expect(await readMarker()).toBeUndefined();
  });

  test('an unreachable server still consumes the cooldown and never rejects', async () => {
    await setCredentials();
    proxyPingMock.mockRejectedValue(new Error('network down'));
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const result = await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);

    expect(result).toEqual({ success: true, data: { pinged: true, throttled: false } });
    expect((await readMarker())?.fingerprint).toBe(computeFingerprint(SERVER_URL, API_KEY));

    const second = await refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);
    expect(second.data).toEqual({ pinged: false, throttled: true });
    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });

  test('a caller arriving while a ping is in flight awaits it instead of starting a second', async () => {
    await setCredentials();
    let release: (() => void) | undefined;
    proxyPingMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ success: true, data: { capabilities: [FALLBACK_FLAG], protocolVersion: 1 } });
        }),
    );
    const { refreshCompatOnDemand } = await loadServerCompatSync();

    const first = refreshCompatOnDemand('capability-blocked', FALLBACK_FLAG);
    await vi.waitFor(() => expect(proxyPingMock).toHaveBeenCalledTimes(1));

    await getMockBrowser().storage.local.remove(DEMAND_REPING_KEY);
    const second = refreshCompatOnDemand('overlay-open');
    await new Promise((resolve) => setTimeout(resolve, 0));

    release?.();

    expect((await first).data).toEqual({ pinged: true, throttled: false });
    expect((await second).data).toEqual({ pinged: false, throttled: true });
    expect(proxyPingMock).toHaveBeenCalledTimes(1);
  });
});
