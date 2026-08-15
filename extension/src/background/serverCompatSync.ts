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
  hasCapability,
  invalidateServerCompat,
  isBlocked,
  markCapabilityAbsent,
  recordPingFailure,
  recordPingSuccess,
} from '#src/shared/serverCompat';

const SERVER_URL_KEY = 'gdluxx_server_url';
const API_KEY_KEY = 'gdluxx_api_key';

const STALE_COMPAT_TTL_MS = 5 * 60 * 60 * 1000; // 5h

export const COMPAT_ALARM_NAME = 'gdluxx-compat-refresh';
const COMPAT_ALARM_PERIOD_MINUTES = 6 * 60; // 6h

const DEMAND_REPING_KEY = 'gdluxx_compat_reping';
const DEMAND_REPING_COOLDOWN_MS = 15 * 60 * 1000; // 15m per fingerprint

export type CompatRefreshReason = 'capability-blocked' | 'overlay-open';

interface DemandRepingMarker {
  fingerprint: string;
  attemptedAt: number;
}

export interface CompatRefreshResult {
  pinged: boolean;
  throttled: boolean;
}

let inFlightDemandPing: Promise<void> | null = null;

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
  const lastSuccess = typeof compat?.pingedAt === 'number' ? compat.pingedAt : null;
  if (lastSuccess !== null && now - lastSuccess < STALE_COMPAT_TTL_MS) {
    return; // confirmed within the TTL
  }
  await pingIfConfigured();
}

async function readDemandMarker(): Promise<DemandRepingMarker | null> {
  try {
    const stored = await browser.storage.local.get(DEMAND_REPING_KEY);
    const value = stored[DEMAND_REPING_KEY];
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<DemandRepingMarker>;
    return typeof record.fingerprint === 'string' && typeof record.attemptedAt === 'number'
      ? { fingerprint: record.fingerprint, attemptedAt: record.attemptedAt }
      : null;
  } catch {
    return null;
  }
}

export async function refreshCompatOnDemand(
  reason: CompatRefreshReason,
  flag?: string,
): Promise<ProxyApiResult<CompatRefreshResult>> {
  const { serverUrl, apiKey } = await readCredentials();
  if (!serverUrl || !apiKey) {
    return { success: true, data: { pinged: false, throttled: false } };
  }

  if (flag && hasCapability(await getServerCompat(), flag) === 'yes') {
    return { success: true, data: { pinged: false, throttled: false } };
  }

  const fingerprint = computeFingerprint(serverUrl, apiKey);
  const now = Date.now();
  const marker = await readDemandMarker();
  if (
    marker &&
    marker.fingerprint === fingerprint &&
    now - marker.attemptedAt < DEMAND_REPING_COOLDOWN_MS
  ) {
    return { success: true, data: { pinged: false, throttled: true } };
  }

  if (inFlightDemandPing) {
    await inFlightDemandPing;
    return { success: true, data: { pinged: false, throttled: true } };
  }

  try {
    await browser.storage.local.set({
      [DEMAND_REPING_KEY]: { fingerprint, attemptedAt: now } satisfies DemandRepingMarker,
    });
  } catch (error) {
    console.error('gdluxx: failed to persist the compat re-ping marker', error);
  }

  console.warn(
    `gdluxx: re-pinging server compatibility on demand (reason: ${reason}${
      flag ? `, flag: ${flag}` : ''
    })`,
  );

  const ping = (async () => {
    try {
      await pingAndRecordCompat(serverUrl, apiKey);
    } catch (error) {
      console.error('gdluxx: on-demand compat re-ping failed', error);
    }
  })();
  inFlightDemandPing = ping;

  try {
    await ping;
  } finally {
    if (inFlightDemandPing === ping) inFlightDemandPing = null;
  }

  return { success: true, data: { pinged: true, throttled: false } };
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
