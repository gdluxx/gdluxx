/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, removeValue, setValue } from './storage';
import type { SubRule } from './substitution';
import type { ProfileScope, StorageStatus } from './storageProfiles';

export interface SavedSubProfile {
  id: string;
  scope: ProfileScope;
  host: string;
  path?: string;
  origin?: string;
  rules: SubRule[];
  name?: string;
  applyToPreview: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface SubsBundle {
  version: number;
  profiles: Record<string, SavedSubProfile>;
}

export interface SaveSubProfileInput {
  scope: ProfileScope;
  host: string;
  origin?: string;
  path?: string;
  rules: SubRule[];
  name?: string;
  applyToPreview: boolean;
}

export interface SubProfileLookupResult {
  id: string;
  profile: SavedSubProfile;
}

interface ActiveRulesBundle {
  version: number;
  rules: SubRule[];
}

const STORAGE_KEY = 'gdluxx_sub_profiles';
const VERSION_KEY = 'gdluxx_sub_profiles_version';
const APPLY_DEFAULT_KEY = 'gdluxx_sub_apply_default';
const SCOPE_PREF_KEY = 'gdluxx_sub_scope_preference';
const ACTIVE_RULES_KEY = 'gdluxx_sub_active_rules';

const BUNDLE_VERSION = 1;
const ACTIVE_RULES_VERSION = 1;
const MAX_TOTAL_PROFILES = 500;
const MAX_PROFILES_PER_HOST = 50;
export const MAX_RULES_PER_PROFILE = 20;

let bundleCache: SubsBundle | null = null;
let activeRulesCache: SubRule[] | null = null;
let storageStatus: StorageStatus = { degraded: false };

function emptyBundle(): SubsBundle {
  return { version: BUNDLE_VERSION, profiles: {} };
}

function emptyActiveBundle(): ActiveRulesBundle {
  return { version: ACTIVE_RULES_VERSION, rules: [] };
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

function sanitiseFlags(flags: string): string {
  if (!flags) return 'g';
  const unique = new Set(flags.split('').filter(Boolean));
  if (!unique.has('g')) unique.add('g');
  return Array.from(unique).join('');
}

function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneRule(rule: SubRule, order: number): SubRule {
  return {
    id: rule.id?.trim() || generateRuleId(),
    pattern: rule.pattern?.trim() ?? '',
    replacement: rule.replacement ?? '',
    flags: sanitiseFlags(rule.flags ?? ''),
    enabled: rule.enabled !== false,
    order,
  };
}

function cloneRules(source: SubRule[]): SubRule[] {
  return source.slice(0, MAX_RULES_PER_PROFILE).map((rule, index) => cloneRule(rule, index));
}

function migrateBundle(stored: SubsBundle | null | undefined): SubsBundle {
  if (!stored || typeof stored !== 'object' || typeof stored.profiles !== 'object') {
    return emptyBundle();
  }

  const bundle: SubsBundle = {
    version: BUNDLE_VERSION,
    profiles: {},
  };

  for (const [, profile] of Object.entries(stored.profiles)) {
    if (!profile || typeof profile !== 'object') continue;
    const host = normaliseHost(profile.host);
    const scope = profile.scope ?? 'host';
    const origin = scope === 'host' ? undefined : normaliseOrigin(profile.origin);
    const path = scope === 'path' ? (normalisePath(profile.path) ?? '/') : undefined;
    const rules = Array.isArray(profile.rules) ? cloneRules(profile.rules) : [];
    if (rules.length === 0) continue;
    const safeId = buildProfileId(scope, host, origin, path);
    bundle.profiles[safeId] = {
      id: safeId,
      scope,
      host,
      origin,
      path,
      rules,
      name: profile.name?.trim() || undefined,
      applyToPreview: profile.applyToPreview ?? false,
      createdAt: profile.createdAt ?? Date.now(),
      updatedAt: profile.updatedAt ?? Date.now(),
      lastUsed: profile.lastUsed ?? undefined,
    };
  }

  pruneByLimits(bundle);
  return bundle;
}

async function loadBundle(): Promise<SubsBundle> {
  if (bundleCache) return bundleCache;
  try {
    const stored = await getValue<SubsBundle | null>(STORAGE_KEY, null);
    bundleCache = migrateBundle(stored);
    storageStatus = { degraded: false };
    await persistBundle();
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

function toProfileArray(bundle: SubsBundle): Array<[string, SavedSubProfile]> {
  return Object.entries(bundle.profiles);
}

function pruneByLimits(bundle: SubsBundle): void {
  const entries = toProfileArray(bundle);
  if (entries.length > MAX_TOTAL_PROFILES) {
    entries
      .sort(([, a], [, b]) => {
        const aLast = a.lastUsed ?? a.updatedAt;
        const bLast = b.lastUsed ?? b.updatedAt;
        return aLast - bLast;
      })
      .slice(0, entries.length - MAX_TOTAL_PROFILES)
      .forEach(([id]) => {
        delete bundle.profiles[id];
      });
  }

  const grouped = new Map<string, Array<[string, SavedSubProfile]>>();
  for (const entry of toProfileArray(bundle)) {
    const [id, profile] = entry;
    const list = grouped.get(profile.host) ?? [];
    list.push([id, profile]);
    grouped.set(profile.host, list);
  }

  for (const [, list] of grouped) {
    if (list.length <= MAX_PROFILES_PER_HOST) continue;
    list
      .sort(([, a], [, b]) => {
        const aLast = a.lastUsed ?? a.updatedAt;
        const bLast = b.lastUsed ?? b.updatedAt;
        return aLast - bLast;
      })
      .slice(0, list.length - MAX_PROFILES_PER_HOST)
      .forEach(([id]) => {
        delete bundle.profiles[id];
      });
  }
}

export function buildProfileId(
  scope: ProfileScope,
  host: string,
  origin?: string,
  path?: string,
): string {
  const safeHost = normaliseHost(host);
  if (scope === 'path') {
    return `${scope}::${safeHost}::${normalisePath(path) ?? '/'}`;
  }
  if (scope === 'origin') {
    return `${scope}::${safeHost}::${normaliseOrigin(origin) ?? safeHost}`;
  }
  return `${scope}::${safeHost}`;
}

function matchByScope(url: URL, profile: SavedSubProfile): boolean {
  if (profile.scope === 'host') {
    return profile.host === normaliseHost(url.hostname);
  }
  if (profile.scope === 'origin') {
    return (
      profile.host === normaliseHost(url.hostname) && profile.origin === normaliseOrigin(url.origin)
    );
  }
  const candidatePath = normalisePath(url.pathname) ?? '/';
  return (
    profile.host === normaliseHost(url.hostname) &&
    profile.path === candidatePath &&
    profile.scope === 'path'
  );
}

export async function saveSubProfile(input: SaveSubProfileInput): Promise<SubProfileLookupResult> {
  const effectiveRules = cloneRules(input.rules ?? []).filter((rule) => rule.pattern.length > 0);
  if (effectiveRules.length === 0) {
    throw new Error('Add at least one substitution rule before saving');
  }

  const bundle = await loadBundle();
  const now = Date.now();
  const host = normaliseHost(input.host);
  const origin = input.scope === 'host' ? undefined : normaliseOrigin(input.origin);
  const path = input.scope === 'path' ? (normalisePath(input.path) ?? '/') : undefined;
  const id = buildProfileId(input.scope, host, origin, path);
  const existing = bundle.profiles[id];

  const profile: SavedSubProfile = {
    id,
    scope: input.scope,
    host,
    origin,
    path,
    rules: effectiveRules,
    name: input.name?.trim() || existing?.name,
    applyToPreview: input.applyToPreview ?? existing?.applyToPreview ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastUsed: now,
  };

  bundle.profiles[id] = profile;
  pruneByLimits(bundle);
  await persistBundle();
  return { id, profile };
}

export async function deleteSubProfile(id: string): Promise<void> {
  const bundle = await loadBundle();
  if (bundle.profiles[id]) {
    delete bundle.profiles[id];
    await persistBundle();
  }
}

export async function renameSubProfile(id: string, name: string): Promise<void> {
  const bundle = await loadBundle();
  const profile = bundle.profiles[id];
  if (!profile) return;
  profile.name = name.trim() || undefined;
  profile.updatedAt = Date.now();
  bundle.profiles[id] = profile;
  await persistBundle();
}

export async function getSubProfilesForHost(host: string): Promise<SavedSubProfile[]> {
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

export async function loadSubProfiles(): Promise<SavedSubProfile[]> {
  const bundle = await loadBundle();
  return Object.values(bundle.profiles);
}

export async function exportSubProfiles(): Promise<SubsBundle> {
  const bundle = await loadBundle();
  return {
    version: bundle.version,
    profiles: { ...bundle.profiles },
  };
}

export async function importSubProfiles(bundle: SubsBundle): Promise<void> {
  if (!bundle || typeof bundle !== 'object' || typeof bundle.profiles !== 'object') {
    throw new Error('Invalid substitution profile payload');
  }

  const current = await loadBundle();
  const merged: SubsBundle = {
    version: BUNDLE_VERSION,
    profiles: { ...current.profiles },
  };

  for (const profile of Object.values(bundle.profiles)) {
    if (!profile || typeof profile !== 'object') continue;
    const rules = Array.isArray(profile.rules) ? cloneRules(profile.rules) : [];
    if (rules.length === 0) continue;
    const scope = profile.scope ?? 'host';
    const host = normaliseHost(profile.host);
    const origin = scope === 'host' ? undefined : normaliseOrigin(profile.origin);
    const path = scope === 'path' ? (normalisePath(profile.path) ?? '/') : undefined;
    const id = buildProfileId(scope, host, origin, path);
    merged.profiles[id] = {
      id,
      scope,
      host,
      origin,
      path,
      rules,
      name: profile.name?.trim() || undefined,
      applyToPreview: profile.applyToPreview ?? false,
      createdAt: profile.createdAt ?? Date.now(),
      updatedAt: profile.updatedAt ?? Date.now(),
      lastUsed: profile.lastUsed ?? undefined,
    };
  }

  bundleCache = merged;
  pruneByLimits(bundleCache);
  await persistBundle();
}

export async function clearSubProfiles(): Promise<void> {
  bundleCache = emptyBundle();
  await persistBundle();
}

export async function getSubProfileForUrl(
  urlString: string,
): Promise<SubProfileLookupResult | null> {
  const bundle = await loadBundle();
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const matches = toProfileArray(bundle).sort(([, a], [, b]) => {
    const weight = (profile: SavedSubProfile) =>
      profile.scope === 'path' ? 3 : profile.scope === 'origin' ? 2 : 1;
    const weightDiff = weight(b) - weight(a);
    if (weightDiff !== 0) return weightDiff;
    const aLast = a.lastUsed ?? a.updatedAt;
    const bLast = b.lastUsed ?? b.updatedAt;
    return bLast - aLast;
  });

  for (const [id, profile] of matches) {
    if (matchByScope(url, profile)) {
      profile.lastUsed = Date.now();
      bundle.profiles[id] = profile;
      await persistBundle();
      return { id, profile };
    }
  }
  return null;
}

export async function getSubStorageStatus(): Promise<StorageStatus> {
  await loadBundle();
  return storageStatus;
}

export async function getPreferredSubScope(): Promise<ProfileScope | null> {
  try {
    const stored = await getValue<ProfileScope | null>(SCOPE_PREF_KEY, null);
    return stored ?? null;
  } catch {
    return null;
  }
}

export async function setPreferredSubScope(scope: ProfileScope): Promise<void> {
  try {
    await setValue(SCOPE_PREF_KEY, scope);
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

export async function getAutoApplySubDefault(): Promise<boolean> {
  try {
    const stored = await getValue<boolean | null>(APPLY_DEFAULT_KEY, null);
    return stored ?? true;
  } catch {
    return true;
  }
}

export async function setAutoApplySubDefault(enabled: boolean): Promise<void> {
  await setValue(APPLY_DEFAULT_KEY, enabled);
}

async function readActiveRulesBundle(): Promise<ActiveRulesBundle> {
  if (activeRulesCache) {
    return { version: ACTIVE_RULES_VERSION, rules: [...activeRulesCache] };
  }

  const stored = await getValue<ActiveRulesBundle | null>(ACTIVE_RULES_KEY, null);
  if (!stored || typeof stored !== 'object') {
    activeRulesCache = [];
    return emptyActiveBundle();
  }

  const rules = Array.isArray(stored.rules) ? cloneRules(stored.rules) : [];
  activeRulesCache = [...rules];
  return {
    version: ACTIVE_RULES_VERSION,
    rules,
  };
}

async function persistActiveRulesBundle(bundle: ActiveRulesBundle): Promise<void> {
  await setValue(ACTIVE_RULES_KEY, { ...bundle, rules: [...bundle.rules] });
  activeRulesCache = [...bundle.rules];
}

export async function loadActiveSubRules(): Promise<SubRule[]> {
  const bundle = await readActiveRulesBundle();
  return [...bundle.rules];
}

export async function persistActiveSubRules(rules: SubRule[]): Promise<void> {
  const bundle: ActiveRulesBundle = {
    version: ACTIVE_RULES_VERSION,
    rules: cloneRules(rules),
  };
  await persistActiveRulesBundle(bundle);
}

export async function clearActiveSubRules(): Promise<void> {
  activeRulesCache = [];
  await removeValue(ACTIVE_RULES_KEY);
}

export async function addActiveSubRule(rule: SubRule): Promise<void> {
  const bundle = await readActiveRulesBundle();
  const next = [...bundle.rules, cloneRule(rule, bundle.rules.length)];
  await persistActiveRulesBundle({ version: ACTIVE_RULES_VERSION, rules: next });
}

export async function updateActiveSubRule(id: string, updates: Partial<SubRule>): Promise<void> {
  const bundle = await readActiveRulesBundle();
  const index = bundle.rules.findIndex((rule) => rule.id === id);
  if (index === -1) return;
  const updated = { ...bundle.rules[index], ...updates };
  const next = [...bundle.rules];
  next[index] = cloneRule(updated, index);
  await persistActiveRulesBundle({ version: ACTIVE_RULES_VERSION, rules: next });
}

export async function removeActiveSubRule(id: string): Promise<void> {
  const bundle = await readActiveRulesBundle();
  const next = bundle.rules.filter((rule) => rule.id !== id);
  await persistActiveRulesBundle({
    version: ACTIVE_RULES_VERSION,
    rules: cloneRules(next),
  });
}
