/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/* eslint-disable no-console */

import type { Statement } from 'better-sqlite3';
import { openDatabase } from '$lib/server/database';
import { MAX_DOMAINS, MAX_TOTAL_BYTES } from '$lib/server/validation/extensionCookies';

const db = openDatabase();

function getCurrentTimestamp(): number {
  return Date.now();
}

export type CookieSameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

export interface StoredCookie {
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

export interface CookieDomainEntry {
  domain: string;
  cookies: StoredCookie[];
  syncedBy: string | null;
  updatedAt: number;
}

export interface CookieBundle {
  version: number;
  domains: Record<string, CookieDomainEntry>;
}

interface CookieBackupRow {
  api_key_id: string;
  bundle_json: string;
  domain_count: number;
  cookie_count: number;
  synced_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface CookieBackup {
  apiKeyId: string;
  bundle: CookieBundle;
  domainCount: number;
  cookieCount: number;
  syncedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CookieDomainMetadata {
  domain: string;
  cookieCount: number;
  expiredCount: number;
  earliestExpiry: number | null;
  syncedBy: string | null;
  updatedAt: number;
}

export interface CookieBackupMetadata {
  hasBackup: boolean;
  domains: CookieDomainMetadata[];
  domainCount: number;
  cookieCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface CookieDomainMatch {
  apiKeyId: string;
  domain: string;
  entry: CookieDomainEntry;
}

export class CookieBackupLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CookieBackupLimitError';
  }
}

interface PreparedStatements {
  select: Statement<[string]>;
  selectAll: Statement<[]>;
  upsert: Statement<[string, string, number, number, string | null, number, number]>;
  delete: Statement<[string]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    try {
      statements = {
        select: db.prepare(
          `SELECT api_key_id, bundle_json, domain_count, cookie_count, synced_by, created_at, updated_at
           FROM extension_cookie_backups
           WHERE api_key_id = ?`,
        ),
        selectAll: db.prepare(
          `SELECT api_key_id, bundle_json, domain_count, cookie_count, synced_by, created_at, updated_at
           FROM extension_cookie_backups
           ORDER BY updated_at DESC`,
        ),
        upsert: db.prepare(
          `INSERT INTO extension_cookie_backups (api_key_id, bundle_json, domain_count, cookie_count, synced_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(api_key_id) DO UPDATE SET
             bundle_json = excluded.bundle_json,
             domain_count = excluded.domain_count,
             cookie_count = excluded.cookie_count,
             synced_by = excluded.synced_by,
             updated_at = excluded.updated_at`,
        ),
        delete: db.prepare('DELETE FROM extension_cookie_backups WHERE api_key_id = ?'),
      };
    } catch (error) {
      console.error('Failed to prepare extension cookie backup statements', error);
      throw error;
    }
  }

  return statements;
}

const emptyBundle = (): CookieBundle => ({ version: 1, domains: {} });

export function normalizeCookieDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\./, '').replace(/\.$/, '');
}

export function isCookieExpired(cookie: StoredCookie, nowSeconds: number): boolean {
  if (cookie.session === true || cookie.expirationDate === undefined) {
    return false;
  }
  return cookie.expirationDate <= nowSeconds;
}

function parseBundle(row: CookieBackupRow): CookieBundle {
  try {
    const parsed = JSON.parse(row.bundle_json);
    if (parsed && typeof parsed === 'object' && 'domains' in parsed) {
      return parsed as CookieBundle;
    }
  } catch (error) {
    console.error('Failed to parse cookie backup payload', error);
  }
  return emptyBundle();
}

function mapRow(row: CookieBackupRow | undefined): CookieBackup | null {
  if (!row) {
    return null;
  }
  return {
    apiKeyId: row.api_key_id,
    bundle: parseBundle(row),
    domainCount: row.domain_count,
    cookieCount: row.cookie_count,
    syncedBy: row.synced_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDomains(bundle: CookieBundle): Record<string, CookieDomainEntry> {
  if (!bundle || typeof bundle !== 'object') {
    return {};
  }
  const domains = bundle.domains;
  if (!domains || typeof domains !== 'object') {
    return {};
  }
  return domains;
}

function countCookies(bundle: CookieBundle): number {
  return Object.values(getDomains(bundle)).reduce(
    (total, entry) => total + (Array.isArray(entry?.cookies) ? entry.cookies.length : 0),
    0,
  );
}

export function summarizeCookieDomain(entry: CookieDomainEntry): CookieDomainMetadata {
  const nowSeconds = Math.floor(getCurrentTimestamp() / 1000);
  const cookies = Array.isArray(entry?.cookies) ? entry.cookies : [];
  let expiredCount = 0;
  let earliestExpiry: number | null = null;

  for (const cookie of cookies) {
    if (isCookieExpired(cookie, nowSeconds)) {
      expiredCount += 1;
      continue;
    }
    if (cookie.expirationDate === undefined) {
      continue;
    }
    if (earliestExpiry === null || cookie.expirationDate < earliestExpiry) {
      earliestExpiry = cookie.expirationDate;
    }
  }

  return {
    domain: entry.domain,
    cookieCount: cookies.length,
    expiredCount,
    earliestExpiry,
    syncedBy: entry.syncedBy ?? null,
    updatedAt: entry.updatedAt,
  };
}

export function toCookieBackupMetadata(backup: CookieBackup | null): CookieBackupMetadata {
  if (!backup) {
    return {
      hasBackup: false,
      domains: [],
      domainCount: 0,
      cookieCount: 0,
      syncedBy: null,
      updatedAt: null,
    };
  }

  const domains = Object.values(getDomains(backup.bundle))
    .map((entry) => summarizeCookieDomain(entry))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  return {
    hasBackup: true,
    domains,
    domainCount: domains.length,
    cookieCount: domains.reduce((total, entry) => total + entry.cookieCount, 0),
    syncedBy: backup.syncedBy,
    updatedAt: backup.updatedAt,
  };
}

export function getCookieBackup(apiKeyId: string): CookieBackup | null {
  try {
    const row = getStatements().select.get(apiKeyId) as CookieBackupRow | undefined;
    return mapRow(row);
  } catch (error) {
    console.error('Failed to fetch cookie backup', { apiKeyId, error });
    return null;
  }
}

export function mergeCookieDomain(
  bundle: CookieBundle,
  domain: string,
  cookies: StoredCookie[],
  syncedBy: string | null,
  now: number,
): CookieBundle {
  const key = normalizeCookieDomain(domain);
  const domains = { ...getDomains(bundle) };
  const isNewDomain = !(key in domains);

  if (isNewDomain && Object.keys(domains).length >= MAX_DOMAINS) {
    throw new CookieBackupLimitError(
      `Cookie backup already holds the maximum of ${MAX_DOMAINS} domains.`,
    );
  }

  domains[key] = {
    domain: key,
    cookies,
    syncedBy,
    updatedAt: now,
  };

  return { version: bundle?.version ?? 1, domains };
}

export function saveCookieDomain(
  apiKeyId: string,
  domain: string,
  cookies: StoredCookie[],
  syncedBy?: string | null,
): CookieBackup | null {
  const key = normalizeCookieDomain(domain);
  if (!key) {
    throw new CookieBackupLimitError('Domain is required.');
  }

  const now = getCurrentTimestamp();
  const existing = getCookieBackup(apiKeyId);
  const merged = mergeCookieDomain(
    existing?.bundle ?? emptyBundle(),
    key,
    cookies,
    syncedBy ?? null,
    now,
  );

  const bundleJson = JSON.stringify(merged);
  if (bundleJson.length > MAX_TOTAL_BYTES) {
    throw new CookieBackupLimitError(
      `Cookie backup exceeds the maximum size of ${MAX_TOTAL_BYTES} bytes.`,
    );
  }

  try {
    getStatements().upsert.run(
      apiKeyId,
      bundleJson,
      Object.keys(merged.domains).length,
      countCookies(merged),
      syncedBy ?? null,
      existing?.createdAt ?? now,
      now,
    );
    return getCookieBackup(apiKeyId);
  } catch (error) {
    console.error('Failed to persist cookie backup', { apiKeyId, error });
    return null;
  }
}

export function deleteCookieBackup(apiKeyId: string, domain?: string): boolean {
  if (domain === undefined) {
    try {
      const result = getStatements().delete.run(apiKeyId);
      return result.changes > 0;
    } catch (error) {
      console.error('Failed to delete cookie backup', { apiKeyId, error });
      return false;
    }
  }

  const key = normalizeCookieDomain(domain);
  const existing = getCookieBackup(apiKeyId);
  if (!existing) {
    return false;
  }

  const currentDomains = getDomains(existing.bundle);
  if (!(key in currentDomains)) {
    return false;
  }

  const domains = Object.fromEntries(
    Object.entries(currentDomains).filter(([name]) => name !== key),
  );
  const bundle: CookieBundle = { version: existing.bundle?.version ?? 1, domains };
  const now = getCurrentTimestamp();

  try {
    getStatements().upsert.run(
      apiKeyId,
      JSON.stringify(bundle),
      Object.keys(domains).length,
      countCookies(bundle),
      existing.syncedBy,
      existing.createdAt,
      now,
    );
    return true;
  } catch (error) {
    console.error('Failed to delete cookie domain', { apiKeyId, domain: key, error });
    return false;
  }
}

export function hostDomainCandidates(hostname: string): string[] {
  const host = normalizeCookieDomain(hostname);
  if (!host) {
    return [];
  }
  const labels = host.split('.');
  if (labels.length < 2) {
    return [host];
  }
  const candidates: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) {
    candidates.push(labels.slice(i).join('.'));
  }
  return candidates;
}

/**
 * Whether a cookie's own domain covers a host, per cookie-scoping rules
 *
 * A cookie stored at `.example.com` applies to `example.com` and every
 * subdomain, so it is usable by a job on `cdn.example.com` even though the
 * bundle is keyed on whatever host it was captured from
 */
export function cookieDomainMatchesHost(cookieDomain: string, hostname: string): boolean {
  const domain = normalizeCookieDomain(cookieDomain);
  const host = normalizeCookieDomain(hostname);
  if (!domain || !host) {
    return false;
  }
  return host === domain || host.endsWith(`.${domain}`);
}

export function findCookieDomainForHost(hostname: string): CookieDomainMatch | null {
  const candidates = hostDomainCandidates(hostname);
  if (candidates.length === 0) {
    return null;
  }

  let rows: CookieBackupRow[];
  try {
    rows = getStatements().selectAll.all() as CookieBackupRow[];
  } catch (error) {
    console.error('Failed to scan cookie backups', { hostname, error });
    return null;
  }

  const backups = rows.map((row) => mapRow(row)).filter((backup) => backup !== null);

  for (const candidate of candidates) {
    for (const backup of backups) {
      const entry = getDomains(backup.bundle)[candidate];
      if (entry && Array.isArray(entry.cookies) && entry.cookies.length > 0) {
        return { apiKeyId: backup.apiKeyId, domain: candidate, entry };
      }
    }
  }

  // No entry is keyed on this host or any parent of it, but an entry captured
  // from a sibling host may still hold registrable-domain cookies that apply
  // here such as a bundle keyed `www.example.com` holding `.example.com`
  // cookies serves a job on `cdn.example.com`. Narrow the entry to just the
  // cookies that actually apply
  for (const backup of backups) {
    for (const entry of Object.values(getDomains(backup.bundle))) {
      const cookies = Array.isArray(entry?.cookies) ? entry.cookies : [];
      const applicable = cookies.filter((cookie) =>
        cookieDomainMatchesHost(cookie.domain, hostname),
      );
      if (applicable.length > 0) {
        return {
          apiKeyId: backup.apiKeyId,
          domain: entry.domain,
          entry: { ...entry, cookies: applicable },
        };
      }
    }
  }

  return null;
}
