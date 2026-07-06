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
import type {
  ActiveExtractionConfig,
  ContainerSource,
  ExtractionBundle,
  ExtractionConfig,
  ExtractionProfile,
  GalleryDisplayConfig,
  ImageSource,
  TargetedExtractionConfig,
} from '#src/content/types';
import type { SubRule } from './substitution';

export type ProfileScope = 'host' | 'origin' | 'path';

interface StorageStatus {
  degraded: boolean;
  error?: string;
}

export interface SaveExtractionProfileInput {
  scope: ProfileScope;
  host: string;
  origin?: string;
  path?: string;
  extraction: ExtractionConfig;
  rules: SubRule[];
  applyToPreview: boolean;
  autoApply?: boolean;
  name?: string;
  gallery?: GalleryDisplayConfig;
}

export interface ExtractionProfileLookupResult {
  id: string;
  profile: ExtractionProfile;
}

export interface ResolveScopeResult {
  scope: ProfileScope;
  host: string;
  origin: string;
  path: string;
}

const STORAGE_KEY = 'gdluxx_extraction_profiles';
const VERSION_KEY = 'gdluxx_extraction_profiles_version';
const SCOPE_PREF_KEY = 'gdluxx_extraction_scope_preference';
const ACTIVE_CONFIG_KEY = 'gdluxx_extraction_active_config';
const GALLERY_DEFAULTS_KEY = 'gdluxx_extraction_gallery_defaults';

const BUNDLE_VERSION = 1 as const;
const MAX_TOTAL_PROFILES = 500;
const MAX_PROFILES_PER_HOST = 50;
export const MAX_RULES_PER_PROFILE = 20;

export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  mode: 'range',
  startSelector: '',
  endSelector: '',
};

export const DEFAULT_GALLERY_CONFIG: GalleryDisplayConfig = {
  thumbSizes: [150, 200, 300],
  gap: 12,
  border: 30,
  buttonCorner: 'bottom-right',
};

let bundleCache: ExtractionBundle | null = null;
let storageStatus: StorageStatus = { degraded: false };

function emptyBundle(): ExtractionBundle {
  return { version: BUNDLE_VERSION, profiles: {} };
}

function normaliseString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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

function cloneContainerSource(source: ContainerSource): ContainerSource {
  if (source.via === 'selector') {
    return { via: 'selector', selector: normaliseString(source.selector) };
  }
  if (source.via === 'string') {
    return {
      via: 'string',
      begin: normaliseString(source.begin),
      end: normaliseString(source.end),
    };
  }
  return { via: 'body' };
}

function cloneImageSource(source: ImageSource): ImageSource {
  if (source.via === 'string') {
    return {
      via: 'string',
      begin: normaliseString(source.begin),
      end: normaliseString(source.end),
    };
  }
  return {
    via: 'selector',
    selector: normaliseString(source.selector),
    attr: normaliseString(source.attr) || 'src',
  };
}

function cloneExtractionConfig(config: ExtractionConfig): ExtractionConfig {
  if (config.mode === 'targeted') {
    return {
      mode: 'targeted',
      container: cloneContainerSource(config.container),
      images: cloneImageSource(config.images),
    };
  }
  return {
    mode: 'range',
    startSelector: normaliseString(config.startSelector),
    endSelector: normaliseString(config.endSelector),
  };
}

function cloneRule(rule: SubRule, order: number): SubRule {
  return {
    id: normaliseString(rule.id) || `rule_${Date.now()}_${order}`,
    pattern: normaliseString(rule.pattern).trim(),
    replacement: normaliseString(rule.replacement),
    flags: normaliseString(rule.flags) || 'g',
    enabled: rule.enabled !== false,
    order,
  };
}

function cloneRules(rules: SubRule[] | undefined): SubRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.slice(0, MAX_RULES_PER_PROFILE).map((rule, index) => cloneRule(rule, index));
}

function cloneGalleryConfig(
  config: GalleryDisplayConfig | undefined,
): GalleryDisplayConfig | undefined {
  if (!config) return undefined;
  const [small, medium, large] = config.thumbSizes ?? DEFAULT_GALLERY_CONFIG.thumbSizes;
  return {
    thumbSizes: [small, medium, large],
    gap: config.gap,
    border: config.border,
    buttonCorner: config.buttonCorner,
  };
}

function cloneExtractionProfile(profile: ExtractionProfile): ExtractionProfile {
  return {
    id: normaliseString(profile.id),
    scope: profile.scope,
    host: normaliseHost(profile.host),
    origin: normaliseOrigin(profile.origin),
    path: normalisePath(profile.path),
    extraction: cloneExtractionConfig(profile.extraction),
    rules: cloneRules(profile.rules),
    applyToPreview: profile.applyToPreview === true,
    autoApply: profile.autoApply !== false,
    name: profile.name?.trim() || undefined,
    gallery: cloneGalleryConfig(profile.gallery),
    createdAt: typeof profile.createdAt === 'number' ? profile.createdAt : Date.now(),
    updatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : Date.now(),
    lastUsed: typeof profile.lastUsed === 'number' ? profile.lastUsed : undefined,
  };
}

function cloneExtractionBundle(bundle: ExtractionBundle): ExtractionBundle {
  const profiles: Record<string, ExtractionProfile> = {};
  for (const [id, profile] of Object.entries(bundle.profiles ?? {})) {
    profiles[id] = cloneExtractionProfile(profile);
  }
  return { version: BUNDLE_VERSION, profiles };
}

function cloneActiveConfig(config: ActiveExtractionConfig): ActiveExtractionConfig {
  return {
    extraction: cloneExtractionConfig(config.extraction),
    rules: cloneRules(config.rules),
    applyToPreview: config.applyToPreview === true,
  };
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

export function resolveScopeParts(urlString: string): ResolveScopeResult | null {
  try {
    const parsed = new URL(urlString);
    return {
      scope: 'host',
      host: normaliseHost(parsed.hostname),
      origin: parsed.origin,
      path: normalisePath(parsed.pathname) ?? '/',
    };
  } catch {
    return null;
  }
}

export function isTargetedConfigValid(config: TargetedExtractionConfig): boolean {
  const c = config.container;
  if (c.via === 'selector' && !c.selector.trim()) return false;
  if (c.via === 'string' && (!c.begin || !c.end)) return false;
  const i = config.images;
  if (i.via === 'selector' && !i.selector.trim()) return false;
  if (i.via === 'string' && (!i.begin || !i.end)) return false;
  return true;
}

export function hasExtractionContent(profile: ExtractionProfile): boolean {
  const { extraction, rules, gallery } = profile;
  if (extraction.mode === 'range') {
    if (extraction.startSelector.trim() || extraction.endSelector.trim()) return true;
  } else {
    if (isTargetedConfigValid(extraction)) return true;
  }
  if (rules.some((r) => r.pattern.trim().length > 0)) return true;
  if (gallery !== undefined) return true;
  return false;
}

function pruneByLimits(bundle: ExtractionBundle): void {
  const entries = Object.entries(bundle.profiles);
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

  const grouped = new Map<string, Array<[string, ExtractionProfile]>>();
  for (const [id, profile] of Object.entries(bundle.profiles)) {
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

async function loadBundle(): Promise<ExtractionBundle> {
  if (bundleCache) return bundleCache;
  try {
    const stored = await getValue<ExtractionBundle | null>(STORAGE_KEY, null);
    if (!stored || typeof stored !== 'object' || typeof stored.profiles !== 'object') {
      bundleCache = emptyBundle();
      await persistBundle();
      return bundleCache;
    }
    bundleCache = cloneExtractionBundle(stored);
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
    await setValue(STORAGE_KEY, cloneExtractionBundle(bundleCache));
    await setValue(VERSION_KEY, BUNDLE_VERSION);
    storageStatus = { degraded: false };
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

function matchByScope(url: URL, profile: ExtractionProfile): boolean {
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

export async function loadExtractionProfiles(): Promise<ExtractionProfile[]> {
  const bundle = await loadBundle();
  return Object.values(bundle.profiles).map((profile) => cloneExtractionProfile(profile));
}

export async function exportExtractionProfiles(): Promise<ExtractionBundle> {
  const bundle = await loadBundle();
  return cloneExtractionBundle(bundle);
}

export async function saveExtractionProfile(
  input: SaveExtractionProfileInput,
): Promise<ExtractionProfileLookupResult> {
  const now = Date.now();
  const host = normaliseHost(input.host);
  const origin = input.scope === 'host' ? undefined : normaliseOrigin(input.origin);
  const path = input.scope === 'path' ? (normalisePath(input.path) ?? '/') : undefined;
  const id = buildProfileId(input.scope, host, origin, path);

  const bundle = await loadBundle();
  const existing = bundle.profiles[id];

  const profile: ExtractionProfile = {
    id,
    scope: input.scope,
    host,
    origin,
    path,
    extraction: cloneExtractionConfig(input.extraction),
    rules: cloneRules(input.rules),
    applyToPreview: input.applyToPreview,
    autoApply: input.autoApply ?? existing?.autoApply ?? true,
    name: input.name ?? existing?.name,
    gallery: cloneGalleryConfig(input.gallery ?? existing?.gallery),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastUsed: now,
  };

  if (!hasExtractionContent(profile)) {
    throw new Error(
      'Profile must have selectors, a valid targeted config, rules, or gallery settings',
    );
  }

  bundle.profiles[id] = profile;
  pruneByLimits(bundle);
  await persistBundle();
  return { id, profile: cloneExtractionProfile(profile) };
}

export async function deleteExtractionProfile(id: string): Promise<void> {
  const bundle = await loadBundle();
  if (bundle.profiles[id]) {
    delete bundle.profiles[id];
    await persistBundle();
  }
}

export async function renameExtractionProfile(id: string, name: string): Promise<void> {
  const bundle = await loadBundle();
  const profile = bundle.profiles[id];
  if (!profile) return;
  profile.name = name.trim() || undefined;
  profile.updatedAt = Date.now();
  bundle.profiles[id] = profile;
  await persistBundle();
}

export async function getProfilesForHost(host: string): Promise<ExtractionProfile[]> {
  const bundle = await loadBundle();
  const safeHost = normaliseHost(host);
  return Object.entries(bundle.profiles)
    .filter(([, profile]) => profile.host === safeHost)
    .sort(([, a], [, b]) => {
      const aLast = a.lastUsed ?? a.updatedAt;
      const bLast = b.lastUsed ?? b.updatedAt;
      return bLast - aLast;
    })
    .map(([, profile]) => cloneExtractionProfile(profile));
}

export async function getProfileForUrl(
  urlString: string,
): Promise<ExtractionProfileLookupResult | null> {
  const bundle = await loadBundle();
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const matches = Object.entries(bundle.profiles)
    .filter(([, profile]) => profile.autoApply)
    .sort(([, a], [, b]) => {
      const weight = (p: ExtractionProfile) =>
        p.scope === 'path' ? 3 : p.scope === 'origin' ? 2 : 1;
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
      return { id, profile: cloneExtractionProfile(profile) };
    }
  }
  return null;
}

function normaliseIncomingProfile(profile: ExtractionProfile): ExtractionProfile | null {
  if (!profile || typeof profile !== 'object') return null;

  // Structural validity check
  if (profile.extraction?.mode === 'targeted') {
    if (!isTargetedConfigValid(profile.extraction as TargetedExtractionConfig)) return null;
  } else if (profile.extraction?.mode !== 'range') {
    return null;
  }

  // Meaningful content check
  if (!hasExtractionContent(profile)) return null;

  const scope = (profile.scope ?? 'host') as ProfileScope;
  const host = normaliseHost(profile.host);
  const origin = scope === 'host' ? undefined : normaliseOrigin(profile.origin);
  const path = scope === 'path' ? (normalisePath(profile.path) ?? '/') : undefined;
  const id = buildProfileId(scope, host, origin, path);

  // Normalise image attr default
  return cloneExtractionProfile({
    id,
    scope,
    host,
    origin,
    path,
    extraction: cloneExtractionConfig(profile.extraction),
    rules: cloneRules(profile.rules),
    applyToPreview: profile.applyToPreview ?? false,
    autoApply: profile.autoApply ?? true,
    name: profile.name?.trim() || undefined,
    gallery: cloneGalleryConfig(profile.gallery),
    createdAt: profile.createdAt ?? Date.now(),
    updatedAt: profile.updatedAt ?? Date.now(),
    lastUsed: profile.lastUsed,
  });
}

export interface ExtractionImportPlan {
  toAdd: ExtractionProfile[];
  toOverwrite: ExtractionProfile[];
  skippedOlder: number;
  skippedInvalid: number;
  newerWins: boolean;
}

export async function planExtractionImport(
  bundle: ExtractionBundle,
  options?: { newerWins?: boolean },
): Promise<ExtractionImportPlan> {
  if (!bundle || typeof bundle !== 'object' || typeof bundle.profiles !== 'object') {
    throw new Error('Invalid extraction profile import payload');
  }

  const newerWins = options?.newerWins === true;
  const current = await loadBundle();
  const plan: ExtractionImportPlan = {
    toAdd: [],
    toOverwrite: [],
    skippedOlder: 0,
    skippedInvalid: 0,
    newerWins,
  };

  for (const incoming of Object.values(bundle.profiles)) {
    const normalised = normaliseIncomingProfile(incoming);
    if (!normalised) {
      plan.skippedInvalid += 1;
      continue;
    }
    const local = current.profiles[normalised.id];
    if (!local) {
      plan.toAdd.push(normalised);
      continue;
    }
    // Equal timestamps mean the same sync generation — treat as up to date.
    if (newerWins && normalised.updatedAt <= local.updatedAt) {
      plan.skippedOlder += 1;
      continue;
    }
    plan.toOverwrite.push(normalised);
  }

  return plan;
}

export async function applyExtractionImportPlan(plan: ExtractionImportPlan): Promise<void> {
  const current = await loadBundle();
  const merged: ExtractionBundle = {
    version: BUNDLE_VERSION,
    profiles: { ...current.profiles },
  };

  for (const profile of plan.toAdd) {
    merged.profiles[profile.id] = cloneExtractionProfile(profile);
  }
  for (const profile of plan.toOverwrite) {
    // Re-check recency at apply time in case the local profile changed while
    // a confirmation dialog was open.
    const local = merged.profiles[profile.id];
    if (plan.newerWins && local && local.updatedAt > profile.updatedAt) continue;
    merged.profiles[profile.id] = cloneExtractionProfile(profile);
  }

  bundleCache = merged;
  pruneByLimits(bundleCache);
  await persistBundle();
}

export async function importExtractionProfiles(bundle: ExtractionBundle): Promise<void> {
  const plan = await planExtractionImport(bundle);
  await applyExtractionImportPlan(plan);
}

export async function clearExtractionProfiles(): Promise<void> {
  bundleCache = emptyBundle();
  await persistBundle();
}

export async function getExtractionStorageStatus(): Promise<StorageStatus> {
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

export async function loadActiveConfig(): Promise<ActiveExtractionConfig | null> {
  try {
    const stored = await getValue<ActiveExtractionConfig | null>(ACTIVE_CONFIG_KEY, null);
    if (!stored || typeof stored !== 'object') return null;
    return cloneActiveConfig(stored);
  } catch {
    return null;
  }
}

export async function persistActiveConfig(config: ActiveExtractionConfig): Promise<void> {
  await setValue(ACTIVE_CONFIG_KEY, cloneActiveConfig(config));
}

export async function clearActiveConfig(): Promise<void> {
  await removeValue(ACTIVE_CONFIG_KEY);
}

export async function loadGalleryDefaults(): Promise<GalleryDisplayConfig> {
  try {
    const stored = await getValue<GalleryDisplayConfig | null>(GALLERY_DEFAULTS_KEY, null);
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_GALLERY_CONFIG };
    return cloneGalleryConfig(stored) ?? { ...DEFAULT_GALLERY_CONFIG };
  } catch {
    return { ...DEFAULT_GALLERY_CONFIG };
  }
}

export async function saveGalleryDefaults(config: GalleryDisplayConfig): Promise<void> {
  await setValue(GALLERY_DEFAULTS_KEY, cloneGalleryConfig(config) ?? { ...DEFAULT_GALLERY_CONFIG });
}
