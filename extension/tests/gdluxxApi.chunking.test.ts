/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { getMockBrowser, resetMockBrowser } from './support/mockBrowser';
import pingFixtureEnvelope from '../../tests/fixtures/previous-release/ping-response.json';

const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';
const MAX_BATCH_URLS_KEY = 'gdluxx_max_batch_urls';

interface SendCommandMessage {
  action: string;
  urls?: string[];
  final?: boolean;
}

beforeEach(async () => {
  await resetMockBrowser();
});

describe('v0.11.0 ping fixture', () => {
  test('has no maxBatchUrls (or capabilities) field', () => {
    expect(pingFixtureEnvelope.data).not.toHaveProperty('maxBatchUrls');
    expect(pingFixtureEnvelope.data).not.toHaveProperty('capabilities');
  });

  test("background.ts's write guard is false for this fixture, so the stored limit is never touched", () => {
    const data = pingFixtureEnvelope.data as { maxBatchUrls?: unknown };
    expect(typeof data.maxBatchUrls === 'number').toBe(false);
  });
});

describe('sendUrls chunking against the default limit a v0.11.0 ping leaves in place', () => {
  test('a batch under the default 200 limit sends in a single message, no throw', async () => {
    const browser = getMockBrowser();
    await browser.storage.local.set({
      [SERVER_URL_KEY]: 'https://gdluxx.example',
      [API_KEY_KEY]: 'test-api-key',
    });

    const calls: number[] = [];
    browser.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as SendCommandMessage;
      const urls = msg.urls ?? [];
      calls.push(urls.length);
      return {
        success: true,
        data: {
          overallSuccess: true,
          results: urls.map((url) => ({ url, success: true, jobId: `job-${url}` })),
        },
      };
    });

    const { sendUrls } = await import('#utils/gdluxxApi');
    const urls = Array.from({ length: 150 }, (_, i) => `https://example.com/${i}`);
    const result = await sendUrls(urls);

    expect(result.success).toBe(true);
    expect(calls).toEqual([150]);
    expect(result.data?.results).toHaveLength(150);
  });

  test('a batch beyond the default 200 limit chunks at 200, no throw', async () => {
    const browser = getMockBrowser();
    await browser.storage.local.set({
      [SERVER_URL_KEY]: 'https://gdluxx.example',
      [API_KEY_KEY]: 'test-api-key',
    });

    const calls: number[] = [];
    browser.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as SendCommandMessage;
      const urls = msg.urls ?? [];
      calls.push(urls.length);
      return {
        success: true,
        data: {
          overallSuccess: true,
          results: urls.map((url) => ({ url, success: true, jobId: `job-${url}` })),
        },
      };
    });

    const { sendUrls } = await import('#utils/gdluxxApi');
    const urls = Array.from({ length: 450 }, (_, i) => `https://example.com/${i}`);
    const result = await sendUrls(urls);

    expect(result.success).toBe(true);
    expect(calls).toEqual([200, 200, 50]);
    expect(result.data?.results).toHaveLength(450);
  });

  test('a previously-learned smaller limit (from a capability-aware server) is honored instead', async () => {
    const browser = getMockBrowser();
    await browser.storage.local.set({
      [SERVER_URL_KEY]: 'https://gdluxx.example',
      [API_KEY_KEY]: 'test-api-key',
      [MAX_BATCH_URLS_KEY]: 50,
    });

    const calls: number[] = [];
    browser.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as SendCommandMessage;
      const urls = msg.urls ?? [];
      calls.push(urls.length);
      return {
        success: true,
        data: {
          overallSuccess: true,
          results: urls.map((url) => ({ url, success: true, jobId: `job-${url}` })),
        },
      };
    });

    const { sendUrls } = await import('#utils/gdluxxApi');
    const urls = Array.from({ length: 120 }, (_, i) => `https://example.com/${i}`);
    const result = await sendUrls(urls);

    expect(result.success).toBe(true);
    expect(calls).toEqual([50, 50, 20]);
  });
});
