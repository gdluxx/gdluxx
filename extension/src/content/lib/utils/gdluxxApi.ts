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
import { expandJobResults } from '#src/shared/jobResults';
import { recordSentUrls } from '#utils/storageSentHistory';

type ProfilesBundle = { version: number; profiles: Record<string, unknown> };
type SubsBundle = { version: number; profiles: Record<string, unknown> };

export type { BatchUrlResult, ExternalSendResponse } from '#src/background/apiProxy';
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

async function sendChunked(
  urls: string[],
  limit: number,
  settings: Settings,
  customDirectory: string | undefined,
  siteDirectory: string | undefined,
  relearned: boolean,
  batchId: string,
): Promise<ApiResult<ExternalSendResponse>> {
  let currentLimit = limit;
  let remaining = urls;
  const results: BatchUrlResult[] = [];
  let batches = 0;
  let firstError: string | undefined;
  let anySucceeded = false;

  while (remaining.length > 0) {
    const chunks = chunkUrls(remaining, currentLimit);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length === 0) {
        remaining = []; // no progress possible, stop the outer loop too
        break;
      }

      const isLastOfSnapshot = i === chunks.length - 1;

      const res = await sendBackgroundRequest<ExternalSendResponse>({
        action: 'sendCommand',
        serverUrl: settings.serverUrl,
        apiKey: settings.apiKey,
        urls: chunk,
        customDirectory,
        siteDirectory,
        batchId,
        final: isLastOfSnapshot,
      });

      if (res.success) {
        batches++;
        anySucceeded = true;
        remaining = remaining.slice(chunk.length);
        results.push(...expandJobResults(chunk, res.data?.results ?? []));
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

function recordAcceptedSends(result: ApiResult<ExternalSendResponse>): void {
  if (!result.success || !result.data?.results) return;
  const accepted = result.data.results
    .filter((entry) => entry.success)
    .map(({ url, jobId }) => ({ url, jobId }));
  if (!accepted.length) return;
  void recordSentUrls(location.hostname.toLowerCase(), accepted).catch((error) => {
    console.error('Failed to record sent URL history', error);
  });
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

  const batchId = crypto.randomUUID();

  if (urls.length <= limit) {
    const result = await sendBackgroundRequest<ExternalSendResponse>({
      action: 'sendCommand',
      serverUrl: settings.serverUrl,
      apiKey: settings.apiKey,
      urls,
      customDirectory,
      siteDirectory,
      batchId,
      final: true,
    });

    if (result.success) {
      const expanded: ApiResult<ExternalSendResponse> = {
        ...result,
        data: {
          overallSuccess: result.data?.overallSuccess ?? false,
          results: expandJobResults(urls, result.data?.results ?? []),
        },
      };
      recordAcceptedSends(expanded);
      return expanded;
    }

    const relearnedLimit = parseStaleLimitError(result.error);
    if (relearnedLimit === null) {
      return result;
    }

    const newLimit = clamp(relearnedLimit, 1, 10000);
    await saveSettings({ maxBatchUrls: newLimit });
    const chunkedResult = await sendChunked(
      urls,
      newLimit,
      settings,
      customDirectory,
      siteDirectory,
      true,
      batchId,
    );
    recordAcceptedSends(chunkedResult);
    return chunkedResult;
  }

  const chunkedResult = await sendChunked(
    urls,
    limit,
    settings,
    customDirectory,
    siteDirectory,
    false,
    batchId,
  );
  recordAcceptedSends(chunkedResult);
  return chunkedResult;
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
