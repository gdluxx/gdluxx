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

const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';

async function loadServerCompat() {
  vi.resetModules();
  return import('#src/shared/serverCompat');
}

async function setCredentials(serverUrl: string, apiKey: string): Promise<void> {
  await getMockBrowser().storage.local.set({
    [SERVER_URL_KEY]: serverUrl,
    [API_KEY_KEY]: apiKey,
  });
}

beforeEach(async () => {
  await resetMockBrowser();
});

describe('hasCapability / isBlocked / mayAttempt (pure, no storage)', () => {
  test('never pinged (pingedAt null, or no record at all) reads unknown', async () => {
    const { hasCapability, isBlocked, mayAttempt } = await loadServerCompat();

    expect(hasCapability(null, 'jobs.polling')).toBe('unknown');
    expect(
      hasCapability(
        {
          fingerprint: 'x',
          serverVersion: null,
          protocolVersion: null,
          capabilities: [],
          pingedAt: null,
          checkedAt: 0,
        },
        'jobs.polling',
      ),
    ).toBe('unknown');
    expect(isBlocked(null, 'jobs.polling')).toBe(false);
    expect(mayAttempt(null, 'jobs.polling')).toBe(true);
  });

  test('a learned-absent flag reads no / isBlocked / not mayAttempt', async () => {
    const { hasCapability, isBlocked, mayAttempt } = await loadServerCompat();
    const compat = {
      fingerprint: 'x',
      serverVersion: '0.11.0',
      protocolVersion: null,
      capabilities: [] as string[],
      pingedAt: 1,
      checkedAt: 1,
    };

    expect(hasCapability(compat, 'jobs.polling')).toBe('no');
    expect(isBlocked(compat, 'jobs.polling')).toBe(true);
    expect(mayAttempt(compat, 'jobs.polling')).toBe(false);
  });

  test('a learned-present flag reads yes', async () => {
    const { hasCapability } = await loadServerCompat();
    const compat = {
      fingerprint: 'x',
      serverVersion: '0.12.0',
      protocolVersion: 1,
      capabilities: ['jobs.polling'],
      pingedAt: 1,
      checkedAt: 1,
    };

    expect(hasCapability(compat, 'jobs.polling')).toBe('yes');
    expect(hasCapability(compat, 'cookies.sync')).toBe('no');
  });
});

describe('recordPingSuccess', () => {
  test('a response with no capabilities field is a learned-absent observation for every flag', async () => {
    const { recordPingSuccess, getServerCompat, hasCapability, computeFingerprint } =
      await loadServerCompat();

    await setCredentials('https://old-server.example', 'key-a');
    const fingerprint = computeFingerprint('https://old-server.example', 'key-a');

    await recordPingSuccess(fingerprint, {});

    const compat = await getServerCompat();
    expect(compat).not.toBeNull();
    expect(compat?.pingedAt).not.toBeNull();
    expect(compat?.capabilities).toEqual([]);
    expect(hasCapability(compat, 'jobs.polling')).toBe('no');
    expect(hasCapability(compat, 'cookies.sync')).toBe('no');
    expect(hasCapability(compat, 'extraction.directorySource')).toBe('no');
  });

  test('a response with capabilities marks exactly the listed flags yes, everything else no', async () => {
    const { recordPingSuccess, getServerCompat, hasCapability, computeFingerprint } =
      await loadServerCompat();

    await setCredentials('https://current.example', 'key-b');
    const fingerprint = computeFingerprint('https://current.example', 'key-b');

    await recordPingSuccess(fingerprint, {
      serverVersion: '0.12.0',
      protocolVersion: 1,
      capabilities: ['jobs.polling', 'cookies.sync'],
    });

    const compat = await getServerCompat();
    expect(hasCapability(compat, 'jobs.polling')).toBe('yes');
    expect(hasCapability(compat, 'cookies.sync')).toBe('yes');
    expect(hasCapability(compat, 'extraction.directorySource')).toBe('no');
    expect(compat?.serverVersion).toBe('0.12.0');
    expect(compat?.protocolVersion).toBe(1);
  });

  test('fingerprint CAS discards a write initiated under credentials that have since changed', async () => {
    const { recordPingSuccess, getServerCompat, computeFingerprint } = await loadServerCompat();

    await setCredentials('https://old.example', 'old-key');
    const staleFingerprint = computeFingerprint('https://old.example', 'old-key');

    await setCredentials('https://new.example', 'new-key');

    await recordPingSuccess(staleFingerprint, {
      serverVersion: '0.11.0',
      capabilities: [],
    });

    expect(await getServerCompat()).toBeNull();
  });

  test('a write under the currently-configured fingerprint is applied', async () => {
    const { recordPingSuccess, getServerCompat, computeFingerprint } = await loadServerCompat();

    await setCredentials('https://current.example', 'key-c');
    const fingerprint = computeFingerprint('https://current.example', 'key-c');

    await recordPingSuccess(fingerprint, {
      serverVersion: '0.12.0',
      capabilities: ['jobs.polling'],
    });

    const compat = await getServerCompat();
    expect(compat?.fingerprint).toBe(fingerprint);
    expect(compat?.serverVersion).toBe('0.12.0');
  });
});

describe('recordPingFailure', () => {
  test('only checkedAt advances - pingedAt and capabilities survive a transient failure', async () => {
    const { recordPingSuccess, recordPingFailure, getServerCompat, computeFingerprint } =
      await loadServerCompat();

    await setCredentials('https://current.example', 'key-d');
    const fingerprint = computeFingerprint('https://current.example', 'key-d');

    await recordPingSuccess(fingerprint, {
      serverVersion: '0.12.0',
      capabilities: ['jobs.polling'],
    });
    const before = await getServerCompat();
    expect(before?.pingedAt).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 2));
    await recordPingFailure(fingerprint);

    const after = await getServerCompat();
    expect(after?.pingedAt).toBe(before?.pingedAt);
    expect(after?.capabilities).toEqual(before?.capabilities);
    expect(after?.serverVersion).toBe(before?.serverVersion);
    expect(after?.checkedAt).toBeGreaterThan(before?.checkedAt ?? 0);
  });

  test('a failure with no prior successful ping records pingedAt: null (still unknown)', async () => {
    const { recordPingFailure, getServerCompat, hasCapability, computeFingerprint } =
      await loadServerCompat();

    await setCredentials('https://never-pinged.example', 'key-e');
    const fingerprint = computeFingerprint('https://never-pinged.example', 'key-e');

    await recordPingFailure(fingerprint);

    const compat = await getServerCompat();
    expect(compat?.pingedAt).toBeNull();
    expect(hasCapability(compat, 'jobs.polling')).toBe('unknown');
  });
});
