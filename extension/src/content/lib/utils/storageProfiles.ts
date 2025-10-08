/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, setValue } from './storage';

export type ProfileScope = 'host' | 'origin' | 'path';

export interface SavedSelectorProfile {
  id: string;
  scope: ProfileScope;
  host: string;
  path?: string;
  origin?: string;
  startSelector: string;
  endSelector: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface ProfilesBundle {
  version: number;
  profiles: Record<string, SavedSelectorProfile>;
}

export interface ProfileLookupResult {
  id: string;
  profile: SavedSelectorProfile;
}

export interface StorageStatus {
  degraded: boolean;
  error?: string;
}

export interface SaveProfileInput {
  scope: ProfileScope;
  host: string;
  origin?: string;
  path?: string;
  startSelector: string;
  endSelector: string;
  name?: string;
}

const STORAGE_KEY = 'gdluxx_selector_profiles';
const VERSION_KEY = 'gdluxx_selector_profiles_version';
const SCOPE_PREF_KEY = 'gdluxx_selector_scope_preference';

const BUNDLE_VERSION = 1;
const MAX_TOTAL_PROFILES = 500;
const MAX_PROFILES_PER_HOST = 50;

let bundleCache: ProfilesBundle | null = null;
let storageStatus: StorageStatus = { degraded: false };

function emptyBundle(): ProfilesBundle {
  return { version: BUNDLE_VERSION, profiles: {} };
}

async function loadBundle(): Promise<ProfilesBundle> {
  if (bundleCache) return bundleCache;

  try {
    const stored = await getValue<ProfilesBundle | null>(STORAGE_KEY, null);
    if (!stored || typeof stored !== 'object') {
      bundleCache = emptyBundle();
      await persistBundle();
      return bundleCache;
    }
    if (!('version' in stored) || stored.version !== BUNDLE_VERSION) {
      const migrated = migrateBundle(stored);
      bundleCache = migrated;
      await persistBundle();
      return bundleCache;
    }
    bundleCache = { version: stored.version, profiles: { ...stored.profiles } };
    storageStatus = { degraded: false };
    return bundleCache;
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
    bundleCache = emptyBundle();
    return bundleCache;
  }
}

async function persistBundle(): Promise<void> {
  if (!bundleCache) return;
  try {
    await setValue(STORAGE_KEY, bundleCache);
    await setValue(VERSION_KEY, BUNDLE_VERSION);
    storageStatus = { degraded: false };
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

function migrateBundle(stored: ProfilesBundle | undefined | null): ProfilesBundle {
  if (!stored) return emptyBundle();
  return {
    version: BUNDLE_VERSION,
    profiles: stored.profiles ?? {},
  };
}

function normaliseHost(host: string): string {
  return host.trim().toLowerCase();
}

function normalisePath(path?: string): string | undefined {
  if (!path) return undefined;
  if (path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function normaliseOrigin(origin?: string): string | undefined {
  return origin?.trim();
}

export function buildProfileId(
  scope: ProfileScope,
  host: string,
  origin?: string,
  path?: string,
): string {
  const safeHost = normaliseHost(host);
  if (scope === 'path') {
    const safePath = normalisePath(path) ?? '/';
    return `${scope}::${safeHost}::${safePath}`;
  }
  if (scope === 'origin') {
    const safeOrigin = normaliseOrigin(origin) ?? safeHost;
    return `${scope}::${safeHost}::${safeOrigin}`;
  }
  return `${scope}::${safeHost}`;
}

function pruneByLimits(bundle: ProfilesBundle) {
  const entries = Object.entries(bundle.profiles);
  if (entries.length <= MAX_TOTAL_PROFILES) {
    enforceHostLimits(bundle);
    return;
  }

  const sorted = entries.sort(([, a], [, b]) => {
    const aLast = a.lastUsed ?? a.updatedAt;
    const bLast = b.lastUsed ?? b.updatedAt;
    return aLast - bLast;
  });

  while (sorted.length > MAX_TOTAL_PROFILES) {
    const toRemove = sorted.shift();
    if (!toRemove) break;
    delete bundle.profiles[toRemove[0]];
  }

  enforceHostLimits(bundle);
}

function enforceHostLimits(bundle: ProfilesBundle) {
  const grouped = new Map<string, Array<[string, SavedSelectorProfile]>>();
  for (const entry of Object.entries(bundle.profiles)) {
    const [id, profile] = entry;
    const list = grouped.get(profile.host) ?? [];
    list.push([id, profile]);
    grouped.set(profile.host, list);
  }
  for (const [, list] of grouped) {
    if (list.length <= MAX_PROFILES_PER_HOST) continue;
    list.sort(([, a], [, b]) => {
      const aLast = a.lastUsed ?? a.updatedAt;
      const bLast = b.lastUsed ?? b.updatedAt;
      return aLast - bLast;
    });
    while (list.length > MAX_PROFILES_PER_HOST) {
      const [id] = list.shift()!;
      delete bundle.profiles[id];
    }
  }
}

export async function loadSelectorProfiles(): Promise<SavedSelectorProfile[]> {
  const bundle = await loadBundle();
  return Object.values(bundle.profiles);
}

export async function exportSelectorProfiles(): Promise<ProfilesBundle> {
  const bundle = await loadBundle();
  return { version: bundle.version, profiles: { ...bundle.profiles } };
}

export async function importSelectorProfiles(bundle: ProfilesBundle): Promise<void> {
  const current = await loadBundle();
  if (!bundle || typeof bundle !== 'object' || typeof bundle.profiles !== 'object') {
    throw new Error('Invalid profile import payload');
  }
  const merged: ProfilesBundle = {
    version: BUNDLE_VERSION,
    profiles: { ...current.profiles },
  };
  for (const [id, profile] of Object.entries(bundle.profiles)) {
    if (!profile.startSelector || !profile.endSelector) continue;
    merged.profiles[id] = {
      ...profile,
      host: normaliseHost(profile.host),
      path: normalisePath(profile.path),
      origin: normaliseOrigin(profile.origin),
      updatedAt: profile.updatedAt ?? Date.now(),
      createdAt: profile.createdAt ?? Date.now(),
    };
  }
  bundleCache = merged;
  pruneByLimits(bundleCache);
  await persistBundle();
}

export async function clearSelectorProfiles(): Promise<void> {
  bundleCache = emptyBundle();
  await persistBundle();
}

function toProfileArray(bundle: ProfilesBundle): Array<[string, SavedSelectorProfile]> {
  return Object.entries(bundle.profiles);
}

export async function getProfilesForHost(host: string): Promise<SavedSelectorProfile[]> {
  const bundle = await loadBundle();
  const safeHost = normaliseHost(host);
  return toProfileArray(bundle)
    .filter(([, profile]) => profile.host === safeHost)
    .sort(([, a], [, b]) => {
      const aLast = a.lastUsed ?? a.updatedAt;
      const bLast = b.lastUsed ?? b.updatedAt;
      return bLast - aLast;
    })
    .map(([, profile]) => profile);
}

export interface ResolveScopeOptions {
  url: string;
  scope: ProfileScope;
}

export function resolveScopeParts({ url, scope }: ResolveScopeOptions): SaveProfileInput {
  const parsed = new URL(url);
  const host = normaliseHost(parsed.hostname);
  const origin = parsed.origin;
  const path = normalisePath(parsed.pathname) ?? '/';

  if (scope === 'host') {
    return { scope, host, origin, startSelector: '', endSelector: '' };
  }
  if (scope === 'origin') {
    return { scope, host, origin, startSelector: '', endSelector: '' };
  }
  return { scope, host, origin, path, startSelector: '', endSelector: '' };
}

export async function saveSelectorProfile(input: SaveProfileInput): Promise<ProfileLookupResult> {
  if (!input.startSelector.trim() && !input.endSelector.trim()) {
    throw new Error('Select at least one selector before saving');
  }
  const bundle = await loadBundle();
  const now = Date.now();
  const host = normaliseHost(input.host);
  const path = normalisePath(input.path);
  const origin = normaliseOrigin(input.origin);
  const id = buildProfileId(input.scope, host, origin, path);
  const existing = bundle.profiles[id];
  const profile: SavedSelectorProfile = {
    id,
    scope: input.scope,
    host,
    origin: input.scope === 'host' ? undefined : (origin ?? undefined),
    path: input.scope === 'path' ? (path ?? '/') : undefined,
    startSelector: input.startSelector.trim(),
    endSelector: input.endSelector.trim(),
    name: input.name ?? existing?.name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastUsed: now,
  };
  bundle.profiles[id] = profile;
  pruneByLimits(bundle);
  await persistBundle();
  return { id, profile };
}

export async function deleteSelectorProfile(id: string): Promise<void> {
  const bundle = await loadBundle();
  if (bundle.profiles[id]) {
    delete bundle.profiles[id];
    await persistBundle();
  }
}

function matchByScope(url: URL, profile: SavedSelectorProfile): boolean {
  if (profile.scope === 'host') {
    return profile.host === normaliseHost(url.hostname);
  }
  if (profile.scope === 'origin') {
    return profile.origin === url.origin && profile.host === normaliseHost(url.hostname);
  }
  const candidatePath = normalisePath(url.pathname) ?? '/';
  return profile.host === normaliseHost(url.hostname) && profile.path === candidatePath;
}

export async function getProfileForUrl(urlString: string): Promise<ProfileLookupResult | null> {
  const bundle = await loadBundle();
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const entries = toProfileArray(bundle);

  const sorted = entries.sort(([, a], [, b]) => {
    const weight = (profile: SavedSelectorProfile) =>
      profile.scope === 'path' ? 3 : profile.scope === 'origin' ? 2 : 1;
    const weightDiff = weight(b) - weight(a);
    if (weightDiff !== 0) return weightDiff;
    const aLast = a.lastUsed ?? a.updatedAt;
    const bLast = b.lastUsed ?? b.updatedAt;
    return bLast - aLast;
  });

  for (const [id, profile] of sorted) {
    if (matchByScope(url, profile)) {
      profile.lastUsed = Date.now();
      bundle.profiles[id] = profile;
      await persistBundle();
      return { id, profile };
    }
  }
  return null;
}

export async function updateProfileLastUsed(id: string): Promise<void> {
  const bundle = await loadBundle();
  const profile = bundle.profiles[id];
  if (!profile) return;
  profile.lastUsed = Date.now();
  bundle.profiles[id] = profile;
  await persistBundle();
}

export async function getSelectorStorageStatus(): Promise<StorageStatus> {
  await loadBundle();
  return storageStatus;
}

export async function getPreferredScope(): Promise<ProfileScope | null> {
  try {
    const pref = await getValue<ProfileScope | null>(SCOPE_PREF_KEY, null);
    return pref ?? null;
  } catch {
    return null;
  }
}

export async function setPreferredScope(scope: ProfileScope): Promise<void> {
  try {
    await setValue(SCOPE_PREF_KEY, scope);
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

export async function renameSelectorProfile(id: string, name: string): Promise<void> {
  const bundle = await loadBundle();
  const profile = bundle.profiles[id];
  if (!profile) return;
  profile.name = name.trim() || undefined;
  profile.updatedAt = Date.now();
  bundle.profiles[id] = profile;
  await persistBundle();
}
