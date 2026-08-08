/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ExtractionBundle } from '#src/content/types';
import type { OptionalProfileField } from '#src/shared/extractionProfileFields';

export interface ProfilesBundle {
  version: number;
  profiles: Record<string, unknown>;
}

export interface SubsBundle {
  version: number;
  profiles: Record<string, unknown>;
}

export interface ProxyApiResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  status?: number;
  strippedFields?: OptionalProfileField[];
}

export interface ProfileBackupData {
  hasBackup: boolean;
  bundle: ProfilesBundle;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface SubBackupData {
  hasBackup: boolean;
  bundle: SubsBundle;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface SkippedProfileNote {
  id: string;
  reason: string;
}

export interface SkippedProfilesReport {
  count: number;
  profiles: SkippedProfileNote[];
}

export interface ExtractionBackupData {
  hasBackup: boolean;
  bundle: ExtractionBundle;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
  skipped?: SkippedProfilesReport;
}

export type CookieSameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

export interface CookiePermissionState {
  granted: boolean;
  reason?: 'cookies' | 'origin' | 'error';
  detail?: string;
}

export interface CookiePayload {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  hostOnly?: boolean;
  sameSite?: CookieSameSite;
  session?: boolean;
  expirationDate?: number;
}

export interface CookieDomainMetadata {
  domain: string;
  cookieCount: number;
  expiredCount: number;
  earliestExpiry: number | null;
  syncedBy: string | null;
  updatedAt: number;
}

export interface CookieBackupData {
  hasBackup: boolean;
  domains: CookieDomainMetadata[];
  domainCount: number;
  cookieCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface BatchUrlResult {
  jobId?: string;
  url: string;
  success: boolean;
  message?: string;
  error?: string;
}

export interface ExternalSendResponse {
  overallSuccess: boolean;
  results: BatchUrlResult[];
}

// Mirror of the server's JobListItem `src/lib/types/jobs.ts`
export type JobStatus = 'running' | 'success' | 'no_action' | 'error';

export interface JobStatusItem {
  id: string;
  url: string;
  status: JobStatus;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  downloadCount: number;
  skipCount: number;
  batchCount?: number;
}

interface DeleteResponse {
  deleted: boolean;
}

const COMMAND_ENDPOINT = '/api/extension/external';
const PING_ENDPOINT = '/api/extension/ping';
const PROFILE_BACKUP_ENDPOINT = '/api/extension/profiles';
const SUB_BACKUP_ENDPOINT = '/api/extension/subs';
const EXTRACTION_BACKUP_ENDPOINT = '/api/extension/extraction';
const COOKIES_ENDPOINT = '/api/extension/cookies';
const JOBS_ENDPOINT = '/api/extension/jobs';

export function ensureHttpScheme(url: string): string {
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

interface ApiEnvelopeLike {
  success?: boolean;
  error?: string;
}

function hasSuccessEnvelope<T extends ApiEnvelopeLike>(
  payload: T | null | undefined,
): payload is T & { success: true } {
  return payload?.success === true;
}

function httpFailureResult<T>(
  response: Response,
  payload: ApiEnvelopeLike | null,
  fallbackMessage: string,
  authFallback: string = 'Invalid API key',
): ProxyApiResult<T> {
  if (response.status === 401 || response.status === 403) {
    return { success: false, status: response.status, error: payload?.error ?? authFallback };
  }
  if (response.status === 0 || response.type === 'opaqueredirect') {
    return {
      success: false,
      status: response.status,
      error:
        'The server redirected the request — check that your gdluxx server URL uses the right scheme and host (e.g. https:// and the exact domain).',
    };
  }
  return { success: false, status: response.status, error: payload?.error ?? fallbackMessage };
}

function envelopeFailureResult<T>(response: Response, message: string): ProxyApiResult<T> {
  return { success: false, status: response.status, error: message };
}

export function isEndpointAbsent(result: ProxyApiResult<unknown>): boolean {
  if (result.success) return false;
  const { status } = result;
  if (status === undefined) return false;
  if (status === 404) return true;
  if (status === 0) return true; // opaqueredirect (redirect: 'manual', cross-origin)
  if (status >= 300 && status < 400) return true; // any 3xx
  if (status >= 200 && status < 300) return true; // 2xx but envelope check failed
  return false; // e.g. 401/403/500 - a real, non-absence failure
}

export interface PingData {
  message?: string;
  maxBatchUrls?: number;
  serverVersion?: string;
  protocolVersion?: number;
  capabilities?: string[];
}

export async function proxyPing(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<PingData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, PING_ENDPOINT), {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ extensionVersion: browser.runtime.getManifest().version }),
    });

    type PingResponse = {
      success?: boolean;
      error?: string;
      data?: PingData;
    };

    const payload = await parseJsonSafe<PingResponse>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(response, payload?.error ?? 'Connection test failed');
    }

    return {
      success: true,
      message: payload.data?.message ?? 'Connection successful!',
      data: payload.data,
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
  siteDirectory?: string,
): Promise<ProxyApiResult<ExternalSendResponse>> {
  try {
    const body: { urls: string[]; customDirectory?: string; siteDirectory?: string } = { urls };
    if (customDirectory) {
      body.customDirectory = customDirectory;
    }
    if (siteDirectory) {
      body.siteDirectory = siteDirectory;
    }

    const response = await fetch(buildUrl(serverUrl, COMMAND_ENDPOINT), {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    type ApiEnvelope = {
      success?: boolean;
      error?: string;
      data?: ExternalSendResponse;
    };

    const payload = (await parseJsonSafe<ApiEnvelope>(response)) ?? {};

    if (!response.ok) {
      return httpFailureResult(
        response,
        payload,
        `Server error: ${response.status}`,
        'Authentication failed. Check your API key.',
      );
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(response, payload.error ?? 'Failed to send URLs');
    }

    const batchResult = payload.data;
    const successCount = Array.isArray(batchResult?.results)
      ? batchResult.results.filter((item) => item?.success).length
      : urls.length;

    return {
      success: true,
      message: `Successfully sent ${successCount} URL${successCount === 1 ? '' : 's'} to gdluxx`,
      data: batchResult ?? { overallSuccess: false, results: [] },
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
      redirect: 'manual',
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
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to load remote backup');
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
      redirect: 'manual',
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
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to save remote backup');
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
      redirect: 'manual',
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
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to delete backup');
    }

    const deleted = payload.data?.deleted ?? false;

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

export async function proxySubsGet(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<SubBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, SUB_BACKUP_ENDPOINT), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: SubBackupData;
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(
        response,
        payload?.error ?? 'Failed to load substitution backup',
      );
    }

    const count = payload.data.profileCount;
    return {
      success: true,
      data: payload.data,
      message: payload.data.hasBackup
        ? `Found ${count} substitution profile${count === 1 ? '' : 's'} on gdluxx`
        : 'No substitution backup found on server',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxySubsPut(
  serverUrl: string,
  apiKey: string,
  bundle: SubsBundle,
  syncedBy?: string,
): Promise<ProxyApiResult<SubBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, SUB_BACKUP_ENDPOINT), {
      method: 'PUT',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ bundle, syncedBy }),
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: SubBackupData;
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(
        response,
        payload?.error ?? 'Failed to save substitution backup',
      );
    }

    const count = payload.data.profileCount;
    return {
      success: true,
      data: payload.data,
      message: `Backed up ${count} substitution profile${count === 1 ? '' : 's'} to gdluxx`,
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxySubsDelete(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<DeleteResponse>> {
  try {
    const response = await fetch(buildUrl(serverUrl, SUB_BACKUP_ENDPOINT), {
      method: 'DELETE',
      redirect: 'manual',
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
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(
        response,
        payload?.error ?? 'Failed to delete substitution backup',
      );
    }

    const deleted = payload.data?.deleted ?? false;
    return {
      success: true,
      data: { deleted },
      message: deleted
        ? 'Removed substitution profile backup from gdluxx'
        : 'No substitution backup existed on gdluxx',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyExtractionGet(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<ExtractionBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, EXTRACTION_BACKUP_ENDPOINT), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: ExtractionBackupData;
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to load extraction backup');
    }

    const count = payload.data.profileCount;
    return {
      success: true,
      data: payload.data,
      message: payload.data.hasBackup
        ? `Found ${count} extraction profile${count === 1 ? '' : 's'} on gdluxx`
        : 'No extraction backup found on server',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyExtractionPut(
  serverUrl: string,
  apiKey: string,
  bundle: ExtractionBundle,
  syncedBy?: string,
): Promise<ProxyApiResult<ExtractionBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, EXTRACTION_BACKUP_ENDPOINT), {
      method: 'PUT',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ bundle, syncedBy }),
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: ExtractionBackupData;
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to save extraction backup');
    }

    const count = payload.data.profileCount;
    return {
      success: true,
      data: payload.data,
      message: `Backed up ${count} extraction profile${count === 1 ? '' : 's'} to gdluxx`,
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyExtractionDelete(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<DeleteResponse>> {
  try {
    const response = await fetch(buildUrl(serverUrl, EXTRACTION_BACKUP_ENDPOINT), {
      method: 'DELETE',
      redirect: 'manual',
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
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(
        response,
        payload?.error ?? 'Failed to delete extraction backup',
      );
    }

    const deleted = payload.data?.deleted ?? false;
    return {
      success: true,
      data: { deleted },
      message: deleted
        ? 'Removed extraction profile backup from gdluxx'
        : 'No extraction backup existed on gdluxx',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyCookiesGet(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<CookieBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, COOKIES_ENDPOINT), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: CookieBackupData;
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to load cookie backup');
    }

    const count = payload.data.domainCount;
    return {
      success: true,
      data: payload.data,
      message: payload.data.hasBackup
        ? `Found ${count} domain${count === 1 ? '' : 's'} with synced cookies on gdluxx`
        : 'No cookies synced to gdluxx',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyCookiesPut(
  serverUrl: string,
  apiKey: string,
  domain: string,
  cookies: CookiePayload[],
  syncedBy?: string,
): Promise<ProxyApiResult<CookieBackupData>> {
  try {
    const response = await fetch(buildUrl(serverUrl, COOKIES_ENDPOINT), {
      method: 'PUT',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ domain, cookies, syncedBy }),
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: CookieBackupData;
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload) || !payload.data) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to sync cookies');
    }

    const normalizedDomain = domain.trim().toLowerCase();
    const domainEntry = payload.data.domains.find((entry) => entry.domain === normalizedDomain);
    const count = domainEntry?.cookieCount ?? cookies.length;

    return {
      success: true,
      data: payload.data,
      message: `Synced ${count} cookie${count === 1 ? '' : 's'} for ${domain} to gdluxx`,
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyCookiesDelete(
  serverUrl: string,
  apiKey: string,
  domain?: string,
): Promise<ProxyApiResult<DeleteResponse>> {
  try {
    const endpoint = domain
      ? `${COOKIES_ENDPOINT}?domain=${encodeURIComponent(domain)}`
      : COOKIES_ENDPOINT;

    const response = await fetch(buildUrl(serverUrl, endpoint), {
      method: 'DELETE',
      redirect: 'manual',
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
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to delete cookies');
    }

    const deleted = payload.data?.deleted ?? false;
    return {
      success: true,
      data: { deleted },
      message: deleted
        ? domain
          ? `Removed cookies for ${domain} from gdluxx`
          : 'Removed cookie backup from gdluxx'
        : 'No cookie backup existed on gdluxx',
    };
  } catch (error) {
    return networkError(error);
  }
}

export async function proxyJobsGet(
  serverUrl: string,
  apiKey: string,
  ids: string[],
): Promise<ProxyApiResult<{ jobs: JobStatusItem[] }>> {
  try {
    const query = ids.map((id) => encodeURIComponent(id)).join(',');

    const response = await fetch(buildUrl(serverUrl, `${JOBS_ENDPOINT}?ids=${query}`), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await parseJsonSafe<{
      success?: boolean;
      error?: string;
      data?: { jobs: JobStatusItem[] };
    }>(response);

    if (!response.ok) {
      return httpFailureResult(response, payload, `Server error: ${response.status}`);
    }

    if (!hasSuccessEnvelope(payload)) {
      return envelopeFailureResult(response, payload?.error ?? 'Failed to load job status');
    }

    return {
      success: true,
      data: payload.data ?? { jobs: [] },
    };
  } catch (error) {
    return networkError(error);
  }
}
