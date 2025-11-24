/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ProfileBackupData, SubBackupData, ProxyApiResult } from '#src/background/apiProxy';
import { loadSettings, validateServerUrl } from '#utils/persistence';
import type { ProfilesBundle } from './storageProfiles';
import type { SubsBundle } from './storageSubstitution';

export type ApiResult<T = unknown> = ProxyApiResult<T>;
export type ProfileBackupPayload = ProfileBackupData;
export type SubBackupPayload = SubBackupData;

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

export async function sendUrls(urls: string[], customDirectory?: string): Promise<ApiResult> {
  if (!urls?.length) {
    return { success: false, error: 'No URLs to send' };
  }

  if (urls.length > 2500) {
    return { success: false, error: 'Too many URLs. Maximum 25 allowed.' };
  }

  const settings = await loadSettings();
  if (!settings.serverUrl || !settings.apiKey) {
    return { success: false, error: 'gdluxx is not configured. Please check settings.' };
  }

  return sendBackgroundRequest({
    action: 'sendCommand',
    serverUrl: settings.serverUrl,
    apiKey: settings.apiKey,
    urls,
    customDirectory,
  });
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
