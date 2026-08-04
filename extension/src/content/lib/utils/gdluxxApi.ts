/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type {
  ProfileBackupData,
  SubBackupData,
  ExtractionBackupData,
  CookieBackupData,
  CookiePermissionState,
  ProxyApiResult,
  BatchUrlResult,
  ExternalSendResponse,
} from '#src/background/apiProxy';
import { loadSettings, saveSettings, validateServerUrl, type Settings } from '#utils/persistence';
import type { ExtractionBundle } from '#src/content/types';

type ProfilesBundle = { version: number; profiles: Record<string, unknown> };
type SubsBundle = { version: number; profiles: Record<string, unknown> };

export type ApiResult<T = unknown> = ProxyApiResult<T>;
export type ProfileBackupPayload = ProfileBackupData;
export type SubBackupPayload = SubBackupData;
export type ExtractionBackupPayload = ExtractionBackupData;
export type CookieBackupPayload = CookieBackupData;
export type CookiePermissionPayload = CookiePermissionState;

type DeletePayload = { deleted: boolean };

async function sendBackgroundRequest<T>(message: unknown): Promise<ApiResult<T>> {
  try {
    if (typeof browser === 'undefined' || !browser.runtime?.sendMessage) {
      return {
        success: false,
        error: 'Browser runtime not available',
      };
    }

    const response = (await browser.runtime.sendMessage(message)) as ApiResult<T> | undefined;

    if (!response || typeof response !== 'object') {
      return {
        success: false,
        error: 'Invalid response from background script',
      };
    }

    return response;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Background messaging failed: ${messageText}`,
    };
  }
}

export async function testConnection(serverUrl: string, apiKey: string): Promise<ApiResult> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest({
    action: 'ping',
    serverUrl,
    apiKey,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function chunkUrls(urls: string[], size: number): string[][] {
  // Guard against a NaN/fractional/zero size, e.g. a corrupt stored limit,
  // producing an empty chunk and looping forever below
  const chunkSize = Math.max(1, Math.floor(Number(size) || 1));
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push(urls.slice(i, i + chunkSize));
  }
  return chunks;
}

// Server rejects an oversized batch with `Too many URLs. Max allowed is N.`;
// parse N so a stale client-side limit can be relearned and retried.
function parseStaleLimitError(error: string | undefined): number | null {
  if (!error) return null;
  const match = error.match(/Max allowed is (\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

const DIRECTLINK_BATCH_SENTINEL = 'directlink batch';

function expandChunkResults(chunk: string[], resultEntries: BatchUrlResult[]): BatchUrlResult[] {
  const sentinel = resultEntries.find((entry) => entry.url === DIRECTLINK_BATCH_SENTINEL);

  // The server trims URLs before echoing them back, so key on the trimmed
  // form on both sides or a whitespace-carrying input URL is misreported.
  const namedByUrl = new Map<string, BatchUrlResult[]>();
  for (const entry of resultEntries) {
    if (entry.url === DIRECTLINK_BATCH_SENTINEL) continue;
    const key = entry.url.trim();
    const existing = namedByUrl.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      namedByUrl.set(key, [entry]);
    }
  }

  return chunk.map((url) => {
    const named = namedByUrl.get(url.trim());
    if (named?.length) {
      return named.shift() as BatchUrlResult;
    }
    if (sentinel) {
      return {
        url,
        success: sentinel.success,
        jobId: sentinel.jobId,
        message: sentinel.message,
        error: sentinel.error,
      };
    }
    return { url, success: false, error: 'No result returned by server' };
  });
}

async function sendChunked(
  urls: string[],
  limit: number,
  settings: Settings,
  customDirectory: string | undefined,
  siteDirectory: string | undefined,
  relearned: boolean,
): Promise<ApiResult<ExternalSendResponse>> {
  let currentLimit = limit;
  let remaining = urls;
  const results: BatchUrlResult[] = [];
  let batches = 0;
  let firstError: string | undefined;
  let anySucceeded = false;

  while (remaining.length > 0) {
    for (const chunk of chunkUrls(remaining, currentLimit)) {
      if (chunk.length === 0) {
        remaining = []; // no progress possible, stop the outer loop too
        break;
      }

      const res = await sendBackgroundRequest<ExternalSendResponse>({
        action: 'sendCommand',
        serverUrl: settings.serverUrl,
        apiKey: settings.apiKey,
        urls: chunk,
        customDirectory,
        siteDirectory,
      });

      if (res.success) {
        batches++;
        anySucceeded = true;
        remaining = remaining.slice(chunk.length);
        results.push(...expandChunkResults(chunk, res.data?.results ?? []));
        continue;
      }

      const errorText = res.error ?? 'Unknown error';
      if (firstError === undefined) firstError = errorText;

      const relearnedLimit = !relearned ? parseStaleLimitError(errorText) : null;
      if (relearnedLimit !== null) {
        relearned = true;
        currentLimit = clamp(relearnedLimit, 1, 10000);
        await saveSettings({ maxBatchUrls: currentLimit });
        break; // re-chunk the still-unsent remainder at the learned limit
      }

      batches++;
      remaining = remaining.slice(chunk.length);
      for (const url of chunk) results.push({ url, success: false, error: errorText });
    }
  }

  const accepted = results.filter((result) => result.success).length;
  const failed = results.length - accepted;

  if (!anySucceeded) {
    return { success: false, error: firstError ?? 'Failed to send URLs' };
  }

  return {
    success: true,
    message: `Sent ${urls.length} URLs in ${batches} batches: ${accepted} accepted, ${failed} failed`,
    data: { overallSuccess: failed === 0, results },
  };
}

export async function sendUrls(
  urls: string[],
  customDirectory?: string,
  siteDirectory?: string,
): Promise<ApiResult<ExternalSendResponse>> {
  if (!urls?.length) {
    return { success: false, error: 'No URLs to send' };
  }

  const settings = await loadSettings();
  if (!settings.serverUrl || !settings.apiKey) {
    return { success: false, error: 'gdluxx is not configured. Please check settings.' };
  }

  const limit = clamp(settings.maxBatchUrls || 200, 1, 10000);

  if (urls.length <= limit) {
    const result = await sendBackgroundRequest<ExternalSendResponse>({
      action: 'sendCommand',
      serverUrl: settings.serverUrl,
      apiKey: settings.apiKey,
      urls,
      customDirectory,
      siteDirectory,
    });

    if (result.success) {
      return result;
    }

    const relearnedLimit = parseStaleLimitError(result.error);
    if (relearnedLimit === null) {
      return result;
    }

    const newLimit = clamp(relearnedLimit, 1, 10000);
    await saveSettings({ maxBatchUrls: newLimit });
    return sendChunked(urls, newLimit, settings, customDirectory, siteDirectory, true);
  }

  return sendChunked(urls, limit, settings, customDirectory, siteDirectory, false);
}

export async function fetchProfileBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<ProfileBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<ProfileBackupPayload>({
    action: 'getProfiles',
    serverUrl,
    apiKey,
  });
}

export async function saveProfileBackup(
  serverUrl: string,
  apiKey: string,
  bundle: ProfilesBundle,
  syncedBy?: string,
): Promise<ApiResult<ProfileBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<ProfileBackupPayload>({
    action: 'saveProfiles',
    serverUrl,
    apiKey,
    bundle,
    syncedBy,
  });
}

export async function deleteProfileBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<DeletePayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<DeletePayload>({
    action: 'deleteProfiles',
    serverUrl,
    apiKey,
  });
}

export async function fetchSubBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<SubBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<SubBackupPayload>({
    action: 'getSubs',
    serverUrl,
    apiKey,
  });
}

export async function saveSubBackup(
  serverUrl: string,
  apiKey: string,
  bundle: SubsBundle,
  syncedBy?: string,
): Promise<ApiResult<SubBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<SubBackupPayload>({
    action: 'saveSubs',
    serverUrl,
    apiKey,
    bundle,
    syncedBy,
  });
}

export async function deleteSubBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<DeletePayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<DeletePayload>({
    action: 'deleteSubs',
    serverUrl,
    apiKey,
  });
}

export async function fetchExtractionBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<ExtractionBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<ExtractionBackupPayload>({
    action: 'getExtraction',
    serverUrl,
    apiKey,
  });
}

export async function saveExtractionBackup(
  serverUrl: string,
  apiKey: string,
  bundle: ExtractionBundle,
  syncedBy?: string,
): Promise<ApiResult<ExtractionBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<ExtractionBackupPayload>({
    action: 'saveExtraction',
    serverUrl,
    apiKey,
    bundle,
    syncedBy,
  });
}

export async function deleteExtractionBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<DeletePayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<DeletePayload>({
    action: 'deleteExtraction',
    serverUrl,
    apiKey,
  });
}

export async function fetchCookieBackup(
  serverUrl: string,
  apiKey: string,
): Promise<ApiResult<CookieBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<CookieBackupPayload>({
    action: 'getCookies',
    serverUrl,
    apiKey,
  });
}

export async function checkCookiePermission(
  originPattern: string,
): Promise<ApiResult<CookiePermissionState>> {
  if (!originPattern) {
    return { success: false, error: 'Unable to determine the current site.' };
  }

  return sendBackgroundRequest<CookiePermissionState>({
    action: 'checkCookiePermission',
    originPattern,
  });
}

export async function syncCookiesForDomain(
  serverUrl: string,
  apiKey: string,
  domain: string,
  originPattern: string,
  syncedBy?: string,
): Promise<ApiResult<CookieBackupPayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (!domain || !originPattern) {
    return { success: false, error: 'Unable to determine the current site.' };
  }

  return sendBackgroundRequest<CookieBackupPayload>({
    action: 'syncCookies',
    serverUrl,
    apiKey,
    domain,
    originPattern,
    syncedBy,
  });
}

export async function deleteCookieBackup(
  serverUrl: string,
  apiKey: string,
  domain?: string,
): Promise<ApiResult<DeletePayload>> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: 'Server URL and API key are required' };
  }

  const validation = validateServerUrl(serverUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return sendBackgroundRequest<DeletePayload>({
    action: 'deleteCookies',
    serverUrl,
    apiKey,
    domain,
  });
}
