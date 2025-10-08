/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ProfilesBundle } from '#src/content/lib/utils/storageProfiles';

export interface ProxyApiResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface ProfileBackupData {
  hasBackup: boolean;
  bundle: ProfilesBundle;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

interface ExternalSendResponse {
  results?: Array<{ success?: boolean }>;
  [key: string]: unknown;
}

interface DeleteResponse {
  deleted: boolean;
}

const COMMAND_ENDPOINT = '/api/extension/external';
const PING_ENDPOINT = '/api/extension/ping';
const PROFILE_BACKUP_ENDPOINT = '/api/extension/profiles';

function ensureHttpScheme(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildUrl(baseUrl: string, endpoint: string): string {
  return `${normalizeBaseUrl(ensureHttpScheme(baseUrl))}${endpoint}`;
}

function networkError<T>(error: unknown): ProxyApiResult<T> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    success: false,
    error: `Network error: ${message}`,
  };
}

export async function proxyPing(serverUrl: string, apiKey: string): Promise<ProxyApiResult> {
  try {
    const response = await fetch(buildUrl(serverUrl, PING_ENDPOINT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    type PingResponse = {
      success?: boolean;
      error?: string;
      data?: { message?: string };
    };

    const payload = await parseJsonSafe<PingResponse>(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: payload?.error ?? 'Invalid API key',
        };
      }
      return {
        success: false,
        error: payload?.error ?? `Server error: ${response.status}`,
      };
    }

    if (payload?.success) {
      return {
        success: true,
        message: payload.data?.message ?? 'Connection successful!',
      };
    }

    return {
      success: false,
      error: payload?.error ?? 'Connection test failed',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyCommand(
  serverUrl: string,
  apiKey: string,
  urls: string[],
  customDirectory?: string,
): Promise<ProxyApiResult<ExternalSendResponse>> {
  try {
    const body: { urls: string[]; customDirectory?: string } = { urls };
    if (customDirectory) {
      body.customDirectory = customDirectory;
    }

    const response = await fetch(buildUrl(serverUrl, COMMAND_ENDPOINT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await parseJsonSafe<ExternalSendResponse>(response)) ?? {};

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Authentication failed. Check your API key.' };
      }
      return {
        success: false,
        error: `Server error: ${response.status}`,
      };
    }

    const successCount = Array.isArray(payload.results)
      ? payload.results.filter((item) => item?.success).length
      : urls.length;

    return {
      success: true,
      message: `Successfully sent ${successCount} URL${successCount === 1 ? '' : 's'} to gdluxx`,
      data: payload,
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyProfilesGet(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<ProfileBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, PROFILE_BACKUP_ENDPOINT), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: ProfileBackupData;
    }>(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: payload?.error ?? 'Invalid API key',
        };
      }
      return {
        success: false,
        error: payload?.error ?? `Server error: ${response.status}`,
      };
    }

    if (!payload?.success || !payload.data) {
      return {
        success: false,
        error: payload?.error ?? 'Failed to load remote backup',
      };
    }

    return {
      success: true,
      data: payload.data,
      message: payload.data.hasBackup
        ? `Found ${payload.data.profileCount} profile${
            payload.data.profileCount === 1 ? '' : 's'
          } available on gdluxx`
        : 'No backup found on server',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyProfilesPut(
  serverUrl: string,
  apiKey: string,
  bundle: ProfilesBundle,
  syncedBy?: string,
): Promise<ProxyApiResult<ProfileBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, PROFILE_BACKUP_ENDPOINT), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ bundle, syncedBy }),
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: ProfileBackupData;
    }>(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: payload?.error ?? 'Invalid API key',
        };
      }
      return {
        success: false,
        error: payload?.error ?? `Server error: ${response.status}`,
      };
    }

    if (!payload?.success || !payload.data) {
      return {
        success: false,
        error: payload?.error ?? 'Failed to save remote backup',
      };
    }

    const count = payload.data.profileCount;
    return {
      success: true,
      data: payload.data,
      message: `Backed up ${count} profile${count === 1 ? '' : 's'} to gdluxx`,
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyProfilesDelete(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<DeleteResponse>> {
  try {
    const response = await fetch(buildUrl(serverUrl, PROFILE_BACKUP_ENDPOINT), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: DeleteResponse;
    }>(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: payload?.error ?? 'Invalid API key',
        };
      }
      return {
        success: false,
        error: payload?.error ?? `Server error: ${response.status}`,
      };
    }

    const deleted = payload?.data?.deleted ?? false;

    return {
      success: true,
      data: { deleted },
      message: deleted
        ? 'Removed selector profile backup from gdluxx'
        : 'No backup existed on gdluxx',
    };
  } catch (error) {
    return networkError(error);
  }
}
