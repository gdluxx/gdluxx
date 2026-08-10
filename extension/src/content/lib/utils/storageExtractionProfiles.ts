/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, readValues, removeValue, setValue, setValues } from './storage';
import type {
  ActiveExtractionConfig,
  ContainerSource,
  DirectorySource,
  ExtractionBundle,
  ExtractionConfig,
  ExtractionProfile,
  GalleryDisplayConfig,
  ImageSource,
  TargetedExtractionConfig,
} from '#src/content/types';
import type { SubRule } from './substitution';
import {
  OPTIONAL_PROFILE_FIELDS,
  type OptionalProfileField,
} from '#src/shared/extractionProfileFields';

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
  directorySource?: DirectorySource | null;
  accumulate?: boolean | null;
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
const DRAFT_CONFIGS_KEY = 'gdluxx_extraction_draft_configs';
const GALLERY_DEFAULTS_KEY = 'gdluxx_extraction_gallery_defaults';

const BUNDLE_VERSION = 1 as const;
const MAX_TOTAL_PROFILES = 1000;
const MAX_PROFILES_PER_HOST = 50;
const MAX_DRAFT_HOSTS = 50;
export const MAX_RULES_PER_PROFILE = 500;
export const COMBINED_BUNDLE_KIND = 'gdluxx.extension-profiles.bundle';
export const COMBINED_ENVELOPE_VERSION = 1;

export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  mode: 'range',
  startSelector: '',
  endSelector: '',
};

export const DEFAULT_IMAGE_SOURCE: ImageSource = {
  via: 'selector',
  selector: 'img',
  attr: 'src',
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
  return rules.map((rule, index) => cloneRule(rule, index));
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

type OptionalProfileFieldValues = Pick<ExtractionProfile, OptionalProfileField>;

// An empty selector means "no source", the UI can toggle the section on
// before anything is typed, and that should never round trip to storage
function cloneDirectorySource(
  source: DirectorySource | null | undefined,
): DirectorySource | null | undefined {
  if (source === null) return null;
  if (!source) return undefined;
  const selector = normaliseString(source.selector).trim();
  if (!selector) return undefined;
  const attr = normaliseString(source.attr).trim();
  const pattern = normaliseString(source.transform?.pattern).trim();
  return {
    via: 'selector',
    selector,
    attr: attr || undefined,
    transform: pattern
      ? {
          pattern,
          replacement: normaliseString(source.transform?.replacement),
          flags: normaliseString(source.transform?.flags) || undefined,
        }
      : undefined,
  };
}

function cloneAccumulate(value: boolean | null | undefined): boolean | null | undefined {
  if (value === null) return null;
  return typeof value === 'boolean' ? value : undefined;
}

const OPTIONAL_FIELD_NORMALISERS: {
  [K in OptionalProfileField]: (value: ExtractionProfile[K]) => ExtractionProfile[K];
} = {
  directorySource: cloneDirectorySource,
  accumulate: cloneAccumulate,
};

function normaliseOptionalFields(
  source: Partial<OptionalProfileFieldValues>,
): OptionalProfileFieldValues {
  const result: Record<string, unknown> = {};
  for (const field of OPTIONAL_PROFILE_FIELDS) {
    const normalise = OPTIONAL_FIELD_NORMALISERS[field] as (value: unknown) => unknown;
    result[field] = normalise(source[field]);
  }
  return result as OptionalProfileFieldValues;
}

export interface OptionalFieldMergeResult {
  profile: ExtractionProfile;
  mergedFields: OptionalProfileField[];
}

export function mergeOptionalProfileFields(
  incoming: ExtractionProfile,
  local: ExtractionProfile | undefined,
): OptionalFieldMergeResult {
  if (!local) return { profile: incoming, mergedFields: [] };

  const mergedFields: OptionalProfileField[] = [];
  const merged: ExtractionProfile = { ...incoming };
  for (const field of OPTIONAL_PROFILE_FIELDS) {
    if (incoming[field] !== undefined) continue; // a value, or an explicit null, wins
    if (local[field] === undefined) continue; // nothing local worth keeping
    (merged as unknown as Record<string, unknown>)[field] = local[field];
    mergedFields.push(field);
  }

  return mergedFields.length > 0
    ? { profile: merged, mergedFields }
    : { profile: incoming, mergedFields };
}

const KNOWN_PROFILE_KEYS: ReadonlySet<string> = new Set<string>([
  'id',
  'scope',
  'host',
  'origin',
  'path',
  'extraction',
  'rules',
  'applyToPreview',
  'autoApply',
  'name',
  'gallery',
  ...OPTIONAL_PROFILE_FIELDS,
  'createdAt',
  'updatedAt',
  'lastUsed',
]);

const KNOWN_BUNDLE_KEYS: ReadonlySet<string> = new Set<string>(['version', 'profiles']);

function cloneUnknownValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as unknown;
    } catch {
      return undefined;
    }
  }
}

function preservedUnknownKeys(
  source: unknown,
  known: ReadonlySet<string>,
): Record<string, unknown> {
  if (!source || typeof source !== 'object') return {};
  const preserved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (known.has(key)) continue;
    if (key === '__proto__') continue;
    const cloned = cloneUnknownValue(value);
    if (cloned !== undefined) preserved[key] = cloned;
  }
  return preserved;
}

function cloneExtractionProfile(profile: ExtractionProfile): ExtractionProfile {
  return {
    ...preservedUnknownKeys(profile, KNOWN_PROFILE_KEYS),
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
    ...normaliseOptionalFields(profile),
    createdAt: typeof profile.createdAt === 'number' ? profile.createdAt : Date.now(),
    updatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : Date.now(),
    lastUsed: typeof profile.lastUsed === 'number' ? profile.lastUsed : undefined,
  };
}

function cloneExtractionBundle(bundle: ExtractionBundle): ExtractionBundle {
  const profiles: Record<string, ExtractionProfile> = {};
  for (const [id, profile] of Object.entries(bundle.profiles ?? {})) {
    if (id === '__proto__') continue;
    profiles[id] = cloneExtractionProfile(profile);
  }
  return {
    ...preservedUnknownKeys(bundle, KNOWN_BUNDLE_KEYS),
    version: BUNDLE_VERSION,
    profiles,
  };
}

function cloneActiveConfig(config: ActiveExtractionConfig): ActiveExtractionConfig {
  return {
    extraction: cloneExtractionConfig(config.extraction),
    rules: cloneRules(config.rules),
    applyToPreview: config.applyToPreview === true,
    ...normaliseOptionalFields(config),
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

function isContainerSourceValid(source: ContainerSource): boolean {
  if (source.via === 'selector') return normaliseString(source.selector).trim().length > 0;
  if (source.via === 'string') return !!source.begin && !!source.end;
  return true; // `body` needs nothing
}

function isImageSourceValid(source: ImageSource): boolean {
  if (source.via === 'string') return !!source.begin && !!source.end;
  return normaliseString(source.selector).trim().length > 0;
}

export function isTargetedConfigValid(config: TargetedExtractionConfig): boolean {
  return isContainerSourceValid(config.container) && isImageSourceValid(config.images);
}

export function normaliseExtractionConfig(config: ExtractionConfig): ExtractionConfig {
  if (config.mode !== 'targeted') return config;

  const container: ContainerSource = isContainerSourceValid(config.container)
    ? config.container
    : { via: 'body' };
  const images: ImageSource = isImageSourceValid(config.images)
    ? config.images
    : { ...DEFAULT_IMAGE_SOURCE };

  if (container === config.container && images === config.images) return config;
  return { mode: 'targeted', container, images };
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
  if (profile.directorySource?.selector.trim()) return true;
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

export const UNREADABLE_BUNDLE_MESSAGE =
  'Saved extraction profiles are stored in a shape this version of the extension does not recognize. They have been left untouched — saving a profile will replace them.';

function storageErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown storage error';
}

function readStoredVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Collapses any targeted config an older build persisted in an unusable shape
// `updatedAt` is left alone intentionally
function repairStoredProfiles(bundle: ExtractionBundle): boolean {
  let changed = false;
  for (const [id, profile] of Object.entries(bundle.profiles)) {
    const repaired = normaliseExtractionConfig(profile.extraction);
    if (repaired !== profile.extraction) {
      bundle.profiles[id] = { ...profile, extraction: repaired };
      changed = true;
    }
  }
  return changed;
}

async function loadBundle(): Promise<ExtractionBundle> {
  if (bundleCache) return bundleCache;

  let entries: Record<string, unknown>;
  try {
    entries = await readValues([STORAGE_KEY, VERSION_KEY]);
  } catch (error) {
    storageStatus = { degraded: true, error: storageErrorMessage(error) };
    bundleCache = emptyBundle();
    return bundleCache;
  }

  const stored = entries[STORAGE_KEY] ?? null;
  const writerVersion = entries[VERSION_KEY] ?? null;

  if (stored === null || stored === undefined) {
    bundleCache = emptyBundle();
    storageStatus = { degraded: false };
    try {
      return await persistBundle(bundleCache);
    } catch {
      return bundleCache;
    }
  }

  // VERSION_KEY holds the version of the build that last wrote
  const declaredVersions = [
    readStoredVersion(writerVersion),
    readStoredVersion((stored as { version?: unknown }).version),
  ].filter((version): version is number => version !== null);
  const newest = Math.max(BUNDLE_VERSION, ...declaredVersions);
  if (newest > BUNDLE_VERSION) {
    storageStatus = { degraded: true, error: BUNDLE_TOO_NEW_MESSAGE };
    throw new BundleVersionTooNewError(newest);
  }

  // Present but unrecognized: data exists in a shape this build cannot read
  const profiles = (stored as { profiles?: unknown }).profiles;
  if (
    typeof stored !== 'object' ||
    Array.isArray(stored) ||
    !profiles ||
    typeof profiles !== 'object' ||
    Array.isArray(profiles)
  ) {
    storageStatus = { degraded: true, error: UNREADABLE_BUNDLE_MESSAGE };
    bundleCache = emptyBundle();
    return bundleCache;
  }

  const loaded = cloneExtractionBundle(stored as ExtractionBundle);
  storageStatus = { degraded: false };

  if (repairStoredProfiles(loaded)) {
    try {
      return await persistBundle(loaded);
    } catch {
      bundleCache = loaded;
      return bundleCache;
    }
  }

  bundleCache = loaded;
  return bundleCache;
}

async function persistBundle(candidate: ExtractionBundle): Promise<ExtractionBundle> {
  const snapshot = cloneExtractionBundle(candidate);
  try {
    await setValues({ [STORAGE_KEY]: snapshot, [VERSION_KEY]: BUNDLE_VERSION });
  } catch (error) {
    storageStatus = { degraded: true, error: storageErrorMessage(error) };
    throw error;
  }
  bundleCache = snapshot;
  storageStatus = { degraded: false };
  return snapshot;
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

export class ProfileRuleLimitError extends Error {
  readonly ruleCount: number;

  constructor(ruleCount: number) {
    super(`A profile can hold at most ${MAX_RULES_PER_PROFILE} rules; this one has ${ruleCount}.`);
    this.name = 'ProfileRuleLimitError';
    this.ruleCount = ruleCount;
  }
}

export class ProfileCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileCapacityError';
  }
}

export async function saveExtractionProfile(
  input: SaveExtractionProfileInput,
): Promise<ExtractionProfileLookupResult> {
  if (Array.isArray(input.rules) && input.rules.length > MAX_RULES_PER_PROFILE) {
    throw new ProfileRuleLimitError(input.rules.length);
  }

  const now = Date.now();
  const host = normaliseHost(input.host);
  const origin = input.scope === 'host' ? undefined : normaliseOrigin(input.origin);
  const path = input.scope === 'path' ? (normalisePath(input.path) ?? '/') : undefined;
  const id = buildProfileId(input.scope, host, origin, path);

  const bundle = await loadBundle();
  const existing = bundle.profiles[id];

  const profile: ExtractionProfile = {
    ...preservedUnknownKeys(existing, KNOWN_PROFILE_KEYS),
    id,
    scope: input.scope,
    host,
    origin,
    path,
    extraction: normaliseExtractionConfig(cloneExtractionConfig(input.extraction)),
    rules: cloneRules(input.rules),
    applyToPreview: input.applyToPreview,
    autoApply: input.autoApply ?? existing?.autoApply ?? true,
    name: input.name ?? existing?.name,
    gallery: cloneGalleryConfig(input.gallery ?? existing?.gallery),
    ...normaliseOptionalFields(input),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastUsed: now,
  };

  if (!hasExtractionContent(profile)) {
    throw new Error(
      'Profile must have selectors, a valid targeted config, rules, or gallery settings',
    );
  }

  const next: ExtractionBundle = { ...bundle, profiles: { ...bundle.profiles, [id]: profile } };
  pruneByLimits(next);
  await persistBundle(next);
  return { id, profile: cloneExtractionProfile(profile) };
}

export async function deleteExtractionProfile(id: string): Promise<void> {
  const bundle = await loadBundle();
  if (!bundle.profiles[id]) return;
  const next: ExtractionBundle = { ...bundle, profiles: { ...bundle.profiles } };
  delete next.profiles[id];
  await persistBundle(next);
}

export async function renameExtractionProfile(id: string, name: string): Promise<void> {
  const bundle = await loadBundle();
  const profile = bundle.profiles[id];
  if (!profile) return;
  const renamed: ExtractionProfile = {
    ...profile,
    name: name.trim() || undefined,
    updatedAt: Date.now(),
  };
  await persistBundle({ ...bundle, profiles: { ...bundle.profiles, [id]: renamed } });
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
      const touched: ExtractionProfile = { ...profile, lastUsed: Date.now() };
      try {
        await persistBundle({ ...bundle, profiles: { ...bundle.profiles, [id]: touched } });
      } catch {
        // Don't let a failed `lastUsed` stop the profile from applying
      }
      return { id, profile: cloneExtractionProfile(touched) };
    }
  }
  return null;
}

function normaliseIncomingProfile(profile: ExtractionProfile): ExtractionProfile | null {
  if (!profile || typeof profile !== 'object') return null;

  if (Array.isArray(profile.rules) && profile.rules.length > MAX_RULES_PER_PROFILE) return null;

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
    ...profile,
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

export const BUNDLE_TOO_NEW_MESSAGE =
  'This backup was created by a newer version of the extension — update the extension to restore it.';

export class BundleVersionTooNewError extends Error {
  readonly bundleVersion: number;

  constructor(bundleVersion: number) {
    super(BUNDLE_TOO_NEW_MESSAGE);
    this.name = 'BundleVersionTooNewError';
    this.bundleVersion = bundleVersion;
  }
}

function readBundleVersion(bundle: unknown): number {
  if (!bundle || typeof bundle !== 'object') return BUNDLE_VERSION;
  const raw = (bundle as { version?: unknown }).version;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : BUNDLE_VERSION;
}

export function assertBundleReadable(bundle: unknown): void {
  const version = readBundleVersion(bundle);
  if (version > BUNDLE_VERSION) {
    throw new BundleVersionTooNewError(version);
  }
}

export const INVALID_IMPORT_MESSAGE = 'Invalid extraction profile import payload';
export const PARTIAL_CONVERSION_MESSAGE =
  'This file looks like a partially converted extension export. Profiles must be nested under "extraction".';

export function normaliseImportPayload(raw: unknown): ExtractionBundle {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(INVALID_IMPORT_MESSAGE);
  }
  const obj = raw as Record<string, unknown>;

  if ('kind' in obj) {
    if (obj.kind !== COMBINED_BUNDLE_KIND) {
      throw new Error('File is not a gdluxx extension profile bundle.');
    }

    if (obj.profiles !== undefined) {
      throw new Error(PARTIAL_CONVERSION_MESSAGE);
    }

    const version = obj.version;
    if (typeof version !== 'number' || !Number.isInteger(version)) {
      throw new Error(INVALID_IMPORT_MESSAGE);
    }
    if (version > COMBINED_ENVELOPE_VERSION) {
      throw new BundleVersionTooNewError(version);
    }

    if (version !== COMBINED_ENVELOPE_VERSION) {
      throw new Error(INVALID_IMPORT_MESSAGE);
    }

    const extraction = obj.extraction;

    if (extraction === undefined) return { version: BUNDLE_VERSION, profiles: {} };
    if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
      throw new Error(INVALID_IMPORT_MESSAGE);
    }
    return extraction as ExtractionBundle;
  }

  const profiles = obj.profiles;
  if (profiles && typeof profiles === 'object' && !Array.isArray(profiles)) {
    const raw = obj.version;
    const version =
      typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : BUNDLE_VERSION;
    return { ...(obj as object), version, profiles } as ExtractionBundle;
  }

  throw new Error(INVALID_IMPORT_MESSAGE);
}

export interface ExtractionImportPlan {
  toAdd: ExtractionProfile[];
  toOverwrite: ExtractionProfile[];
  skippedOlder: number;
  skippedInvalid: number;
  mergedFields: number;
  mergedProfiles: number;
  newerWins: boolean;
}

export interface ExtractionImportApplyResult {
  added: number;
  overwritten: number;
  skippedOlder: number;
  skippedInvalid: number;
  mergedFields: number;
  mergedProfiles: number;
}

export async function planExtractionImport(
  bundle: ExtractionBundle,
  options?: { newerWins?: boolean },
): Promise<ExtractionImportPlan> {
  if (
    !bundle ||
    typeof bundle !== 'object' ||
    Array.isArray(bundle) ||
    !bundle.profiles ||
    typeof bundle.profiles !== 'object' ||
    Array.isArray(bundle.profiles)
  ) {
    throw new Error(INVALID_IMPORT_MESSAGE);
  }

  assertBundleReadable(bundle);

  const newerWins = options?.newerWins === true;
  const current = await loadBundle();
  const plan: ExtractionImportPlan = {
    toAdd: [],
    toOverwrite: [],
    skippedOlder: 0,
    skippedInvalid: 0,
    mergedFields: 0,
    mergedProfiles: 0,
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
    const { mergedFields } = mergeOptionalProfileFields(normalised, local);
    if (mergedFields.length > 0) {
      plan.mergedFields += mergedFields.length;
      plan.mergedProfiles += 1;
    }
    plan.toOverwrite.push(normalised);
  }

  return plan;
}

function collectImportCapViolations(profiles: Record<string, ExtractionProfile>): string[] {
  const violations: string[] = [];
  const entries = Object.values(profiles);

  if (entries.length > MAX_TOTAL_PROFILES) {
    violations.push(
      `Importing would leave ${entries.length} profiles; the extension holds at most ${MAX_TOTAL_PROFILES}.`,
    );
  }

  const perHost = new Map<string, number>();
  for (const profile of entries) {
    perHost.set(profile.host, (perHost.get(profile.host) ?? 0) + 1);
  }
  for (const [host, count] of perHost) {
    if (count > MAX_PROFILES_PER_HOST) {
      violations.push(
        `Host "${host}" would have ${count} profiles; max allowed is ${MAX_PROFILES_PER_HOST}.`,
      );
    }
  }

  return violations;
}

export async function applyExtractionImportPlan(
  plan: ExtractionImportPlan,
): Promise<ExtractionImportApplyResult> {
  const current = await loadBundle();
  const merged: ExtractionBundle = {
    ...current,
    version: BUNDLE_VERSION,
    profiles: { ...current.profiles },
  };

  const applied: ExtractionImportApplyResult = {
    added: 0,
    overwritten: 0,
    skippedOlder: plan.skippedOlder,
    skippedInvalid: plan.skippedInvalid,
    mergedFields: 0,
    mergedProfiles: 0,
  };

  for (const profile of plan.toAdd) {
    const isNew = !(profile.id in merged.profiles);
    merged.profiles[profile.id] = cloneExtractionProfile(profile);
    if (isNew) applied.added += 1;
    else applied.overwritten += 1;
  }
  for (const profile of plan.toOverwrite) {
    // Re-check recency at apply time in case the local profile changed while
    // a confirmation dialog was open.
    const local = merged.profiles[profile.id];
    if (plan.newerWins && local && local.updatedAt > profile.updatedAt) {
      applied.skippedOlder += 1;
      continue;
    }
    const { profile: mergedProfile, mergedFields } = mergeOptionalProfileFields(profile, local);
    if (mergedFields.length > 0) {
      applied.mergedFields += mergedFields.length;
      applied.mergedProfiles += 1;
    }
    merged.profiles[profile.id] = cloneExtractionProfile(mergedProfile);
    applied.overwritten += 1;
  }

  const violations = collectImportCapViolations(merged.profiles);
  if (violations.length > 0) {
    throw new ProfileCapacityError(violations.join('\n'));
  }

  await persistBundle(merged);
  return applied;
}

export async function importExtractionProfiles(
  bundle: ExtractionBundle,
): Promise<ExtractionImportApplyResult> {
  const plan = await planExtractionImport(bundle);
  return applyExtractionImportPlan(plan);
}

export async function clearExtractionProfiles(): Promise<void> {
  await persistBundle(emptyBundle());
}

export async function getExtractionStorageStatus(): Promise<StorageStatus> {
  try {
    await loadBundle();
  } catch {
    // loadBundle sets storageStatus before refusing unreadable storage
  }
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

interface DraftConfigEntry {
  config: ActiveExtractionConfig;
  savedAt: number;
}

type DraftConfigsMap = Record<string, DraftConfigEntry>;

function cloneDraftEntry(entry: unknown): DraftConfigEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as { config?: ActiveExtractionConfig; savedAt?: unknown };
  if (!candidate.config || typeof candidate.config !== 'object') return null;
  return {
    config: cloneActiveConfig(candidate.config),
    savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : Date.now(),
  };
}

function cloneDraftConfigsMap(stored: Record<string, unknown>): DraftConfigsMap {
  const map: DraftConfigsMap = {};
  for (const [host, entry] of Object.entries(stored)) {
    const cloned = cloneDraftEntry(entry);
    if (cloned) map[host] = cloned;
  }
  return map;
}

// Drops the lowest-savedAt entries beyond MAX_DRAFT_HOSTS, mirroring the
// pruneByLimits above, host is the key here, so this is a single flat
// prune rather than a per host grouped one
function pruneDraftConfigs(map: DraftConfigsMap): void {
  const entries = Object.entries(map);
  if (entries.length <= MAX_DRAFT_HOSTS) return;
  entries
    .sort(([, a], [, b]) => a.savedAt - b.savedAt)
    .slice(0, entries.length - MAX_DRAFT_HOSTS)
    .forEach(([host]) => {
      delete map[host];
    });
}

async function loadDraftConfigsMap(): Promise<DraftConfigsMap> {
  try {
    const stored = await getValue<Record<string, unknown> | null>(DRAFT_CONFIGS_KEY, null);
    if (!stored || typeof stored !== 'object') return {};
    return cloneDraftConfigsMap(stored);
  } catch {
    return {};
  }
}

export async function loadDraftConfig(host: string): Promise<ActiveExtractionConfig | null> {
  // Legacy global draft can't be attributed to a host, discard it
  removeValue(ACTIVE_CONFIG_KEY).catch(() => {});

  if (!host) return null;
  try {
    const map = await loadDraftConfigsMap();
    return map[host]?.config ?? null;
  } catch {
    return null;
  }
}

// No module-level cache: every persist re-reads storage so a long lived
// GalleryApp instance on one host never clobbers a draft saved for another
// host in the meantime. Same host last-write-wins is fine for drafts
export async function persistDraftConfig(
  host: string,
  config: ActiveExtractionConfig,
): Promise<void> {
  if (!host) return;
  try {
    const map = await loadDraftConfigsMap();
    map[host] = { config: cloneActiveConfig(config), savedAt: Date.now() };
    pruneDraftConfigs(map);
    await setValue(DRAFT_CONFIGS_KEY, map);
    storageStatus = { degraded: false };
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

export async function clearDraftConfig(host: string): Promise<void> {
  if (!host) return;
  try {
    const map = await loadDraftConfigsMap();
    if (!(host in map)) return;
    delete map[host];
    await setValue(DRAFT_CONFIGS_KEY, map);
    storageStatus = { degraded: false };
  } catch (error) {
    storageStatus = {
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
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
