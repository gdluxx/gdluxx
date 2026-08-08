/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { proxyPing, type PingData, type ProxyApiResult } from '#src/background/apiProxy';
import {
  computeFingerprint,
  getServerCompat,
  invalidateServerCompat,
  isBlocked,
  markCapabilityAbsent,
  recordPingFailure,
  recordPingSuccess,
} from '#src/shared/serverCompat';

const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';

const STALE_COMPAT_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export const COMPAT_ALARM_NAME = 'gdluxx-compat-refresh';
const COMPAT_ALARM_PERIOD_MINUTES = 6 * 60; // 6h

async function readCredentials(): Promise<{ serverUrl: string; apiKey: string }> {
  const stored = await browser.storage.local.get([SERVER_URL_KEY, API_KEY_KEY]);
  return {
    serverUrl: typeof stored[SERVER_URL_KEY] === 'string' ? stored[SERVER_URL_KEY] : '',
    apiKey: typeof stored[API_KEY_KEY] === 'string' ? stored[API_KEY_KEY] : '',
  };
}

export async function pingAndRecordCompat(
  serverUrl: string,
  apiKey: string,
): Promise<ProxyApiResult<PingData>> {
  const fingerprint = computeFingerprint(serverUrl, apiKey);
  const result = await proxyPing(serverUrl, apiKey);
  if (result.success) {
    await recordPingSuccess(fingerprint, {
      serverVersion: result.data?.serverVersion,
      protocolVersion: result.data?.protocolVersion,
      capabilities: result.data?.capabilities,
    });
  } else {
    await recordPingFailure(fingerprint);
  }
  return result;
}

async function pingIfConfigured(): Promise<void> {
  const { serverUrl, apiKey } = await readCredentials();
  if (!serverUrl || !apiKey) return;
  try {
    await pingAndRecordCompat(serverUrl, apiKey);
  } catch (error) {
    console.error('gdluxx: automatic compat ping failed', error);
  }
}

export async function refreshCompatOnLaunch(): Promise<void> {
  await pingIfConfigured();
}

export async function ensureFreshCompat(): Promise<void> {
  const compat = await getServerCompat();
  const now = Date.now();
  if (compat && now - compat.checkedAt < STALE_COMPAT_TTL_MS) {
    return; // fresh enough
  }
  await pingIfConfigured();
}

export async function invalidateAndRepingCompat(serverUrl: string, apiKey: string): Promise<void> {
  const fingerprint = computeFingerprint(serverUrl, apiKey);
  await invalidateServerCompat(fingerprint);
  if (!serverUrl || !apiKey) return;
  try {
    await pingAndRecordCompat(serverUrl, apiKey);
  } catch (error) {
    console.error('gdluxx: re-ping after credential change failed', error);
  }
}

export type CorroborationOutcome = 'confirmed-absent' | 'transient';

export async function corroborateAndMarkAbsent(
  flag: string,
  serverUrl: string,
  apiKey: string,
): Promise<CorroborationOutcome> {
  const result = await pingAndRecordCompat(serverUrl, apiKey);
  if (!result.success) {
    return 'transient';
  }

  const compat = await getServerCompat();
  if (!isBlocked(compat, flag)) {
    return 'transient';
  }

  await markCapabilityAbsent(flag);
  return 'confirmed-absent';
}

export async function markCapabilitiesAbsentFromEvidence(
  flags: readonly string[],
  serverUrl: string,
  apiKey: string,
): Promise<void> {
  if (flags.length === 0) return;

  const fingerprint = computeFingerprint(serverUrl, apiKey);
  const compat = await getServerCompat();
  if (!compat || compat.fingerprint !== fingerprint || compat.pingedAt === null) {
    try {
      await pingAndRecordCompat(serverUrl, apiKey);
    } catch (error) {
      console.error('gdluxx: ping before marking capability absence failed', error);
    }
  }

  for (const flag of flags) {
    await markCapabilityAbsent(flag);
  }
}

export async function ensureCompatAlarm(): Promise<void> {
  await browser.alarms.create(COMPAT_ALARM_NAME, {
    periodInMinutes: COMPAT_ALARM_PERIOD_MINUTES,
  });
}
