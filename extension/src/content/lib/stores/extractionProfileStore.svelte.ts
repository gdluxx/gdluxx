/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import { toastStore } from '#stores/toast';
import type {
  ExtractionConfig,
  ExtractionProfile,
  ExtractionBundle,
  GalleryDisplayConfig,
  RangeExtractionConfig,
  TargetedExtractionConfig,
} from '#src/content/types';
import {
  buildProfileId,
  clearActiveConfig,
  clearExtractionProfiles,
  DEFAULT_EXTRACTION_CONFIG,
  DEFAULT_GALLERY_CONFIG,
  deleteExtractionProfile,
  exportExtractionProfiles,
  getExtractionStorageStatus,
  getPreferredScope,
  getProfileForUrl,
  getProfilesForHost,
  hasExtractionContent,
  importExtractionProfiles,
  isTargetedConfigValid,
  loadActiveConfig,
  loadExtractionProfiles,
  loadGalleryDefaults,
  MAX_RULES_PER_PROFILE,
  persistActiveConfig,
  renameExtractionProfile,
  resolveScopeParts,
  saveExtractionProfile,
  saveGalleryDefaults,
  setPreferredScope,
  type ProfileScope,
  type SaveExtractionProfileInput,
} from '#utils/storageExtractionProfiles';
import { applySubRules, createSubRule, type SubResult, type SubRule } from '#utils/substitution';
import {
  validateServerUrl,
  readIgnoredExtractionProfileIds,
  persistIgnoredExtractionProfileIds,
} from '#utils/persistence';
import {
  deleteExtractionBackup,
  fetchExtractionBackup,
  saveExtractionBackup,
  type ExtractionBackupPayload,
} from '#utils/messaging';
import type { RemoteBackupMeta } from '#src/content/types';

export interface ApplyResult {
  links: string[];
  images: string[];
  linkCounts: Record<string, number>;
  imageCounts: Record<string, number>;
  newSelection: Set<string>;
  modifiedCount: number;
}

export interface ResetResult {
  links: string[];
  images: string[];
  linkCounts: Record<string, number>;
  imageCounts: Record<string, number>;
  newSelection: Set<string>;
}

export function createExtractionProfileStore() {
  // Active config state
  let extraction = $state<ExtractionConfig>({ ...DEFAULT_EXTRACTION_CONFIG });
  let rules = $state<SubRule[]>([]);
  let applyToPreview = $state(false);
  let scope = $state<ProfileScope>('host');

  // Profile management
  let activeProfileId = $state<string | null>(null);
  let activeProfile = $state<ExtractionProfile | null>(null);
  let autoAppliedProfile = $state(false);
  const ignoredProfileIds = new SvelteSet<string>();
  let hostProfiles = $state<ExtractionProfile[]>([]);
  let allProfiles = $state<ExtractionProfile[]>([]);

  // URL modification tracking (from substitution pattern)
  const urlModifications = new SvelteMap<string, SubResult>();
  const modifiedUrls = new SvelteSet<string>();
  let previewCount = $state(0);

  // Remote backup
  let remoteBackupMeta = $state<RemoteBackupMeta | null>(null);
  let backupLoading = $state(false);
  let backupStatusMessage = $state('');

  // UI state
  let profileSearch = $state('');
  let profileNameDrafts = $state<Record<string, string>>({});
  let statusMessage = $state<string | null>(null);
  let storageWarning = $state<string | null>(null);

  // Import/export state
  let importText = $state('');
  let importError = $state<string | null>(null);
  let isImporting = $state(false);
  let isClearing = $state(false);
  let isExporting = $state(false);
  let isSaving = $state(false);

  // Gallery defaults
  let galleryDefaults = $state<GalleryDisplayConfig>({ ...DEFAULT_GALLERY_CONFIG });

  // Lifecycle
  let initialized = $state(false);
  let currentUrl = $state('');
  let configLoaded = $state(false);

  // Derived

  const hasActiveFilters = $derived(() => {
    if (extraction.mode === 'range') {
      return !!(extraction.startSelector.trim() || extraction.endSelector.trim());
    }
    return isTargetedConfigValid(extraction as TargetedExtractionConfig);
  });

  const hasActiveRules = $derived(() =>
    rules.some((r) => r.enabled && r.pattern.trim().length > 0),
  );

  const activeProfileDiffers = $derived(() => {
    if (!activeProfile) return false;
    if (activeProfile.applyToPreview !== applyToPreview) return true;
    if (!extractionConfigsEqual(activeProfile.extraction, extraction)) return true;
    return rulesDiffer(activeProfile.rules, rules);
  });

  const filteredProfiles = $derived(() => {
    if (!profileSearch.trim()) return allProfiles;
    const query = profileSearch.trim().toLowerCase();
    return allProfiles.filter((profile) => {
      const parts = [
        profile.host,
        profile.origin ?? '',
        profile.path ?? '',
        profile.name ?? '',
        profile.scope,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return parts.includes(query);
    });
  });

  // Helpers

  function extractionConfigsEqual(a: ExtractionConfig, b: ExtractionConfig): boolean {
    if (a.mode !== b.mode) return false;
    if (a.mode === 'range' && b.mode === 'range') {
      return a.startSelector === b.startSelector && a.endSelector === b.endSelector;
    }
    if (a.mode === 'targeted' && b.mode === 'targeted') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  function rulesDiffer(profileRules: SubRule[], currentRules: SubRule[]): boolean {
    if (profileRules.length !== currentRules.length) return true;
    for (let index = 0; index < profileRules.length; index += 1) {
      const a = profileRules[index];
      const b = currentRules[index];
      if (
        a.pattern !== b.pattern ||
        a.replacement !== b.replacement ||
        a.flags !== b.flags ||
        a.enabled !== b.enabled ||
        index !== (b.order ?? index)
      ) {
        return true;
      }
    }
    return false;
  }

  function buildProfileMessage(profile: ExtractionProfile): string {
    if (profile.name?.trim()) return profile.name.trim();
    if (profile.scope === 'path' && profile.path) return `${profile.host}${profile.path}`;
    if (profile.scope === 'origin' && profile.origin) return profile.origin;
    return profile.host;
  }

  function setIgnored(next: ReadonlySet<string>) {
    ignoredProfileIds.clear();
    for (const value of next) {
      ignoredProfileIds.add(value);
    }
  }

  function ensureConfiguredForRemote(serverUrl: string, apiKey: string, showToast = true): boolean {
    if (!serverUrl || !apiKey) {
      if (showToast) toastStore.error('Configure your gdluxx server URL and API key first.');
      return false;
    }
    const { valid, error } = validateServerUrl(serverUrl);
    if (!valid) {
      if (showToast) toastStore.error(error ?? 'Invalid server URL');
      return false;
    }
    return true;
  }

  function setRemoteMeta(payload: ExtractionBackupPayload | null) {
    if (!payload) {
      remoteBackupMeta = null;
      return;
    }
    remoteBackupMeta = {
      hasBackup: payload.hasBackup,
      profileCount: payload.profileCount,
      syncedBy: payload.syncedBy,
      updatedAt: payload.updatedAt,
    };
  }

  function getCurrentScopeInput(scopeOverride?: ProfileScope): SaveExtractionProfileInput {
    const scopeToUse = scopeOverride ?? scope;
    if (typeof window === 'undefined') {
      return {
        scope: scopeToUse,
        host: '',
        origin: '',
        path: '/',
        extraction,
        rules,
        applyToPreview,
      };
    }
    const resolved = resolveScopeParts(currentUrl);
    return {
      scope: scopeToUse,
      host: resolved?.host ?? '',
      origin: resolved?.origin,
      path: resolved?.path,
      extraction,
      rules,
      applyToPreview,
    };
  }

  function updateModificationTracking(url: string, result: SubResult | null) {
    if (result === null) {
      urlModifications.delete(url);
      modifiedUrls.delete(url);
      return;
    }
    urlModifications.set(url, result);
    modifiedUrls.add(url);
  }

  // Config setters

  function setExtractionMode(mode: 'range' | 'targeted') {
    if (mode === 'range') {
      extraction = { mode: 'range', startSelector: '', endSelector: '' };
    } else {
      extraction = {
        mode: 'targeted',
        container: { via: 'body' },
        images: { via: 'selector', selector: 'img', attr: 'src' },
      };
    }
  }

  function setStartSelector(value: string) {
    if (extraction.mode !== 'range') return;
    extraction = { ...extraction, startSelector: value } as RangeExtractionConfig;
  }

  function setEndSelector(value: string) {
    if (extraction.mode !== 'range') return;
    extraction = { ...extraction, endSelector: value } as RangeExtractionConfig;
  }

  function setContainerSource(container: TargetedExtractionConfig['container']) {
    if (extraction.mode !== 'targeted') return;
    extraction = { ...extraction, container } as TargetedExtractionConfig;
  }

  function setImageSource(images: TargetedExtractionConfig['images']) {
    if (extraction.mode !== 'targeted') return;
    extraction = { ...extraction, images } as TargetedExtractionConfig;
  }

  function setScope(value: ProfileScope) {
    scope = value;
  }

  function setApplyToPreview(value: boolean) {
    applyToPreview = value;
  }

  function setProfileSearch(value: string) {
    profileSearch = value;
  }

  function setImportText(value: string) {
    importText = value;
    importError = null;
  }

  function updateNameDraft(id: string, value: string) {
    profileNameDrafts[id] = value;
  }

  // Rule management

  function addRule() {
    rules = [...rules, createSubRule('', '', 'g', rules.length)];
  }

  function updateRule(id: string, updates: Partial<SubRule>) {
    rules = rules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
  }

  function deleteRule(id: string) {
    rules = rules.filter((rule) => rule.id !== id).map((r, i) => ({ ...r, order: i }));
  }

  function reorderRules(newOrder: SubRule[]) {
    rules = newOrder.map((rule, index) => ({ ...rule, order: index }));
  }

  // Profile CRUD

  async function saveProfile(scopeOverride?: ProfileScope): Promise<void> {
    // Build a candidate to check hasExtractionContent before hitting storage
    const scopeToUse = scopeOverride ?? scope;
    const resolved = resolveScopeParts(currentUrl);
    const host = resolved?.host ?? '';
    const origin = resolved?.origin;
    const path = resolved?.path;
    const id = buildProfileId(scopeToUse, host, origin, path);
    const now = Date.now();

    const candidate: ExtractionProfile = {
      id,
      scope: scopeToUse,
      host,
      origin: scopeToUse === 'host' ? undefined : origin,
      path: scopeToUse === 'path' ? (path ?? '/') : undefined,
      extraction,
      rules: rules.slice(0, MAX_RULES_PER_PROFILE),
      applyToPreview,
      autoApply: true,
      createdAt: now,
      updatedAt: now,
    };

    if (!hasExtractionContent(candidate)) {
      toastStore.warning('Add selectors, rules, or gallery settings before saving.');
      return;
    }

    if (isSaving) return;
    isSaving = true;

    try {
      const payload = getCurrentScopeInput(scopeToUse);
      const { profile, id: savedId } = await saveExtractionProfile(payload);
      activeProfileId = savedId;
      activeProfile = profile;
      scope = scopeToUse;
      statusMessage = buildProfileMessage(profile);
      autoAppliedProfile = false;

      const nextIgnored = new SvelteSet(ignoredProfileIds);
      if (nextIgnored.has(savedId)) {
        nextIgnored.delete(savedId);
        setIgnored(nextIgnored);
        persistIgnoredExtractionProfileIds(nextIgnored);
      }

      await setPreferredScope(scopeToUse);
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
      toastStore.success('Saved extraction profile for this site.');
    } catch (error) {
      console.error('Failed to save extraction profile', error);
      toastStore.error('Failed to save extraction profile.');
    } finally {
      isSaving = false;
    }
  }

  async function deleteProfile(): Promise<void> {
    if (!activeProfileId) return;
    if (!confirm('Remove the saved extraction profile for this site?')) return;

    try {
      await deleteExtractionProfile(activeProfileId);
      const nextIgnored = new SvelteSet(ignoredProfileIds);
      nextIgnored.delete(activeProfileId);
      setIgnored(nextIgnored);
      persistIgnoredExtractionProfileIds(nextIgnored);

      activeProfileId = null;
      activeProfile = null;
      statusMessage = null;
      autoAppliedProfile = false;

      toastStore.success('Extraction profile removed.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to delete extraction profile', error);
      toastStore.error('Failed to delete extraction profile.');
    }
  }

  async function deleteProfileById(id: string): Promise<void> {
    if (!confirm('Delete this saved extraction profile?')) return;
    try {
      await deleteExtractionProfile(id);
      if (activeProfileId === id) {
        activeProfileId = null;
        activeProfile = null;
        statusMessage = null;
        autoAppliedProfile = false;
      }
      const next = new SvelteSet(ignoredProfileIds);
      if (next.delete(id)) {
        setIgnored(next);
        persistIgnoredExtractionProfileIds(next);
      }
      toastStore.success('Deleted extraction profile.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to delete extraction profile by id', error);
      toastStore.error('Failed to delete extraction profile.');
    }
  }

  async function applyProfile(id: string): Promise<void> {
    await refreshHostProfiles(currentUrl);
    await loadAllProfilesInternal();

    const profile = hostProfiles.find((p) => p.id === id) ?? allProfiles.find((p) => p.id === id);
    if (!profile) return;

    extraction = profile.extraction;
    rules = profile.rules.slice().sort((a, b) => a.order - b.order);
    applyToPreview = profile.applyToPreview;
    activeProfileId = profile.id;
    activeProfile = profile;
    scope = profile.scope;
    statusMessage = buildProfileMessage(profile);
    autoAppliedProfile = false;

    const next = new SvelteSet(ignoredProfileIds);
    if (next.has(profile.id)) {
      next.delete(profile.id);
      setIgnored(next);
      persistIgnoredExtractionProfileIds(next);
    }

    toastStore.success('Applied extraction profile.');
  }

  async function renameProfile(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = allProfiles.find((p) => p.id === id);
    if (existing && (existing.name ?? '') === trimmed) return;

    try {
      await renameExtractionProfile(id, trimmed);
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to rename extraction profile', error);
      toastStore.error('Failed to rename extraction profile.');
    }
  }

  function ignoreProfile(): void {
    if (!activeProfileId) return;
    const next = new SvelteSet(ignoredProfileIds);
    next.add(activeProfileId);
    setIgnored(next);
    persistIgnoredExtractionProfileIds(next);
    statusMessage = 'Saved extraction profile ignored for this session.';
    activeProfileId = null;
    activeProfile = null;
    autoAppliedProfile = false;
    toastStore.info('Saved extraction profile will be ignored until you reload the page.');
  }

  // Import/export

  async function exportProfiles(): Promise<void> {
    if (isExporting) return;
    isExporting = true;
    try {
      const bundle = await exportExtractionProfiles();
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new SvelteDate().toISOString().replace(/[:]/g, '-');
      a.download = `gdluxx-extraction-profiles-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastStore.success('Exported extraction profiles.');
    } catch (error) {
      console.error('Failed to export extraction profiles', error);
      toastStore.error('Failed to export extraction profiles.');
    } finally {
      isExporting = false;
    }
  }

  async function importProfiles(): Promise<void> {
    if (!importText.trim()) {
      importError = 'Paste exported JSON before importing.';
      return;
    }
    if (isImporting) return;
    isImporting = true;
    importError = null;
    try {
      const payload = JSON.parse(importText) as ExtractionBundle;
      await importExtractionProfiles(payload);
      toastStore.success('Imported extraction profiles.');
      importText = '';
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to import extraction profiles', error);
      importError =
        error instanceof Error ? error.message : 'Unknown error while importing profiles';
      toastStore.error('Failed to import extraction profiles.');
    } finally {
      isImporting = false;
    }
  }

  async function clearProfiles(): Promise<void> {
    if (isClearing) return;
    if (!confirm('Clear all saved extraction profiles?')) return;
    isClearing = true;
    try {
      await clearExtractionProfiles();
      activeProfileId = null;
      activeProfile = null;
      statusMessage = null;
      autoAppliedProfile = false;
      const cleared = new SvelteSet<string>();
      setIgnored(cleared);
      persistIgnoredExtractionProfileIds(cleared);
      toastStore.success('Cleared all saved extraction profiles.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to clear extraction profiles', error);
      toastStore.error('Failed to clear extraction profiles.');
    } finally {
      isClearing = false;
    }
  }

  // URL modification (substitution)

  function applyToSelected(
    selectedUrls: string[],
    links: string[],
    images: string[],
    linkCounts: Record<string, number>,
    imageCounts: Record<string, number>,
  ): ApplyResult {
    if (!hasActiveRules()) {
      toastStore.info('Add an active substitution rule before applying.');
      return {
        links,
        images,
        linkCounts,
        imageCounts,
        newSelection: new SvelteSet(selectedUrls),
        modifiedCount: 0,
      };
    }
    if (!selectedUrls.length) {
      toastStore.warning('No items selected. Please select URLs/images to apply substitutions.');
      return {
        links,
        images,
        linkCounts,
        imageCounts,
        newSelection: new SvelteSet(selectedUrls),
        modifiedCount: 0,
      };
    }

    const nextSelected = new SvelteSet(selectedUrls);
    const pendingModifications = new SvelteMap<string, SubResult>();
    const pendingModifiedUrls = new SvelteSet<string>();

    let linksChanged = false;
    let imagesChanged = false;
    let linkCountsChanged = false;
    let imageCountsChanged = false;

    const nextLinks = [...links];
    const nextImages = [...images];
    const nextLinkCounts = { ...linkCounts };
    const nextImageCounts = { ...imageCounts };

    for (const url of selectedUrls) {
      const result = applySubRules(url, rules);
      if (!result.modified) continue;

      const existingMod = urlModifications.get(url);
      if (existingMod) {
        result.initialUrl = existingMod.initialUrl;
        updateModificationTracking(url, null);
      }

      const revertedToInitial = existingMod && result.modifiedUrl === existingMod.initialUrl;

      const imageIndex = images.indexOf(url);
      if (imageIndex !== -1) {
        nextImages[imageIndex] = result.modifiedUrl;
        imagesChanged = true;
        if (nextImageCounts[url]) {
          nextImageCounts[result.modifiedUrl] = nextImageCounts[url];
          delete nextImageCounts[url];
          imageCountsChanged = true;
        }
      }

      const linkIndex = links.indexOf(url);
      if (linkIndex !== -1) {
        nextLinks[linkIndex] = result.modifiedUrl;
        linksChanged = true;
        if (nextLinkCounts[url]) {
          nextLinkCounts[result.modifiedUrl] = nextLinkCounts[url];
          delete nextLinkCounts[url];
          linkCountsChanged = true;
        }
      }

      nextSelected.delete(url);
      nextSelected.add(result.modifiedUrl);

      if (!revertedToInitial) {
        pendingModifications.set(result.modifiedUrl, result);
        pendingModifiedUrls.add(result.modifiedUrl);
      } else {
        updateModificationTracking(result.modifiedUrl, null);
      }
    }

    if (linksChanged) links = nextLinks;
    if (imagesChanged) images = nextImages;
    if (linkCountsChanged) linkCounts = nextLinkCounts;
    if (imageCountsChanged) imageCounts = nextImageCounts;

    if (!pendingModifications.size) {
      toastStore.info('No URLs were modified by the substitution rules');
      return {
        links,
        images,
        linkCounts,
        imageCounts,
        newSelection: nextSelected,
        modifiedCount: 0,
      };
    }

    for (const [key, value] of pendingModifications) {
      updateModificationTracking(key, value);
    }

    const modifiedCount = pendingModifiedUrls.size;
    toastStore.success(
      `Applied substitutions to ${modifiedCount} URL${modifiedCount === 1 ? '' : 's'}`,
    );

    return { links, images, linkCounts, imageCounts, newSelection: nextSelected, modifiedCount };
  }

  function resetModifications(
    links: string[],
    images: string[],
    linkCounts: Record<string, number>,
    imageCounts: Record<string, number>,
  ): ResetResult | null {
    if (modifiedUrls.size === 0) {
      toastStore.info('No modifications to reset');
      return null;
    }

    const nextSelected = new SvelteSet<string>();
    let linksChanged = false;
    let imagesChanged = false;
    let linkCountsChanged = false;
    let imageCountsChanged = false;

    const nextLinks = [...links];
    const nextImages = [...images];
    const nextLinkCounts = { ...linkCounts };
    const nextImageCounts = { ...imageCounts };

    for (const [currentMod, result] of urlModifications) {
      const imageIndex = images.indexOf(currentMod);
      if (imageIndex !== -1) {
        nextImages[imageIndex] = result.initialUrl;
        imagesChanged = true;
        if (nextImageCounts[currentMod]) {
          nextImageCounts[result.initialUrl] = nextImageCounts[currentMod];
          delete nextImageCounts[currentMod];
          imageCountsChanged = true;
        }
      }

      const linkIndex = links.indexOf(currentMod);
      if (linkIndex !== -1) {
        nextLinks[linkIndex] = result.initialUrl;
        linksChanged = true;
        if (nextLinkCounts[currentMod]) {
          nextLinkCounts[result.initialUrl] = nextLinkCounts[currentMod];
          delete nextLinkCounts[currentMod];
          linkCountsChanged = true;
        }
      }

      nextSelected.add(result.initialUrl);
    }

    if (linksChanged) links = nextLinks;
    if (imagesChanged) images = nextImages;
    if (linkCountsChanged) linkCounts = nextLinkCounts;
    if (imageCountsChanged) imageCounts = nextImageCounts;

    urlModifications.clear();
    modifiedUrls.clear();
    toastStore.info('All modifications reset');

    return { links, images, linkCounts, imageCounts, newSelection: nextSelected };
  }

  function clearModifications() {
    urlModifications.clear();
    modifiedUrls.clear();
    previewCount = 0;
  }

  function calculatePreviewCount(selectedUrls: string[]): number {
    if (!hasActiveRules()) {
      previewCount = 0;
      return previewCount;
    }
    if (!selectedUrls.length) {
      previewCount = 0;
      return previewCount;
    }
    let count = 0;
    for (const url of selectedUrls) {
      if (applySubRules(url, rules).modified) count += 1;
    }
    previewCount = count;
    return previewCount;
  }

  // Gallery defaults

  async function loadGalleryDefaultsFromStorage(): Promise<void> {
    try {
      galleryDefaults = await loadGalleryDefaults();
    } catch {
      galleryDefaults = { ...DEFAULT_GALLERY_CONFIG };
    }
  }

  async function saveGalleryDefaultsToStorage(config: GalleryDisplayConfig): Promise<void> {
    try {
      await saveGalleryDefaults(config);
      galleryDefaults = config;
      toastStore.success('Gallery defaults saved.');
    } catch (error) {
      console.error('Failed to save gallery defaults', error);
      toastStore.error('Failed to save gallery defaults.');
    }
  }

  // ---- Remote backup ----

  async function fetchBackupMeta(
    serverUrl: string,
    apiKey: string,
    showToast = false,
  ): Promise<void> {
    if (!ensureConfiguredForRemote(serverUrl, apiKey, showToast)) {
      remoteBackupMeta = null;
      return;
    }
    if (backupLoading) return;
    backupLoading = true;
    backupStatusMessage = '';
    try {
      const res = await fetchExtractionBackup(serverUrl, apiKey);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (showToast && res.message) toastStore.info(res.message);
      } else {
        setRemoteMeta(null);
        if (showToast) toastStore.error(res.error ?? 'Failed to load extraction backup');
      }
    } catch (error) {
      console.error('Failed to fetch extraction backup metadata', error);
      setRemoteMeta(null);
      if (showToast) toastStore.error('Failed to reach gdluxx for extraction backup status.');
    } finally {
      backupLoading = false;
    }
  }

  async function backupToRemote(serverUrl: string, apiKey: string): Promise<void> {
    if (backupLoading) {
      toastStore.warning('Remote operation already in progress');
      return;
    }
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) return;
    backupLoading = true;
    backupStatusMessage = '';
    try {
      const bundle = await exportExtractionProfiles();
      const res = await saveExtractionBackup(serverUrl, apiKey, bundle);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        toastStore.success(res.message ?? 'Backed up extraction profiles to gdluxx.');
      } else {
        toastStore.error(res.error ?? 'Failed to backup extraction profiles to gdluxx.');
      }
    } catch (error) {
      console.error('Failed to backup extraction profiles to gdluxx', error);
      toastStore.error('Failed to backup extraction profiles to gdluxx.');
    } finally {
      backupLoading = false;
    }
  }

  async function restoreFromRemote(serverUrl: string, apiKey: string): Promise<void> {
    if (backupLoading) {
      toastStore.warning('Remote operation already in progress');
      return;
    }
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) return;
    backupLoading = true;
    backupStatusMessage = '';
    try {
      const res = await fetchExtractionBackup(serverUrl, apiKey);
      if (!res.success || !res.data) {
        toastStore.error(res.error ?? 'Failed to load extraction backup.');
        return;
      }
      setRemoteMeta(res.data);
      if (!res.data.hasBackup) {
        toastStore.info('No remote extraction backup found for this API key.');
        return;
      }
      await importExtractionProfiles(res.data.bundle);
      toastStore.success('Restored extraction profiles from gdluxx.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to restore extraction profiles from gdluxx', error);
      toastStore.error('Failed to restore extraction profiles from gdluxx.');
    } finally {
      backupLoading = false;
    }
  }

  async function deleteRemoteBackup(serverUrl: string, apiKey: string): Promise<void> {
    if (backupLoading) {
      toastStore.warning('Remote operation already in progress');
      return;
    }
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) return;
    if (!confirm('Remove the remote extraction profile backup from gdluxx?')) return;
    backupLoading = true;
    backupStatusMessage = '';
    try {
      const res = await deleteExtractionBackup(serverUrl, apiKey);
      if (res.success && res.data) {
        if (res.data.deleted) {
          setRemoteMeta(null);
          toastStore.success('Removed remote extraction backup.');
        } else {
          toastStore.info('No remote extraction backup to delete.');
        }
      } else {
        toastStore.error(res.error ?? 'Failed to delete remote extraction backup.');
      }
    } catch (error) {
      console.error('Failed to delete remote extraction profile backup', error);
      toastStore.error('Failed to delete remote extraction backup.');
    } finally {
      backupLoading = false;
    }
  }

  // Lifecycle

  async function refreshHostProfiles(url: string): Promise<void> {
    if (!url) {
      hostProfiles = [];
      return;
    }
    try {
      const host = new URL(url).hostname;
      hostProfiles = await getProfilesForHost(host);
    } catch {
      hostProfiles = [];
    }
  }

  async function loadAllProfilesInternal(): Promise<void> {
    try {
      const list = await loadExtractionProfiles();
      const sorted = [...list].sort((a, b) => {
        if (a.host !== b.host) return a.host.localeCompare(b.host);
        if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
        const aKey = a.path ?? a.origin ?? '';
        const bKey = b.path ?? b.origin ?? '';
        return aKey.localeCompare(bKey);
      });
      allProfiles = sorted;
      const drafts: Record<string, string> = {};
      for (const profile of sorted) {
        drafts[profile.id] = profile.name ?? '';
      }
      profileNameDrafts = drafts;
    } catch (error) {
      console.error('Failed to load extraction profiles', error);
      allProfiles = [];
      profileNameDrafts = {};
    }
  }

  async function autoApplyMatchingProfile(): Promise<void> {
    if (!initialized || !currentUrl) return;
    if (activeProfileId && !ignoredProfileIds.has(activeProfileId)) return;

    try {
      const match = await getProfileForUrl(currentUrl);
      if (match && !ignoredProfileIds.has(match.id)) {
        extraction = match.profile.extraction;
        rules = match.profile.rules.slice().sort((a, b) => a.order - b.order);
        applyToPreview = match.profile.applyToPreview;
        activeProfileId = match.id;
        activeProfile = match.profile;
        scope = match.profile.scope;
        statusMessage = buildProfileMessage(match.profile);
        autoAppliedProfile = true;
      }
    } catch (error) {
      console.error('Failed to auto-apply extraction profile', error);
    }
  }

  async function initialize(url: string): Promise<void> {
    const urlChanged = currentUrl !== url;
    if (initialized && !urlChanged) return;

    currentUrl = url;

    if (!initialized) {
      // Load active config
      try {
        const active = await loadActiveConfig();
        if (active) {
          extraction = active.extraction;
          rules = active.rules.sort((a, b) => a.order - b.order);
          applyToPreview = active.applyToPreview;
        } else {
          extraction = { ...DEFAULT_EXTRACTION_CONFIG };
          rules = [createSubRule('', '', 'g', 0)];
          applyToPreview = false;
        }
      } catch (error) {
        console.error('Failed to load active extraction config', error);
        extraction = { ...DEFAULT_EXTRACTION_CONFIG };
        rules = [createSubRule('', '', 'g', 0)];
        applyToPreview = false;
      } finally {
        configLoaded = true;
      }

      // Load preferred scope
      try {
        const pref = await getPreferredScope();
        if (pref) scope = pref;
      } catch {
        // keep default
      }

      // Check storage status
      try {
        const status = await getExtractionStorageStatus();
        storageWarning = status.degraded
          ? (status.error ?? 'Extraction profile storage degraded')
          : null;
      } catch {
        storageWarning = 'Extraction profile storage unavailable';
      }

      // Load ignored IDs
      const ignored = readIgnoredExtractionProfileIds();
      setIgnored(ignored);

      // Load gallery defaults
      await loadGalleryDefaultsFromStorage();

      initialized = true;
    }

    await refreshHostProfiles(url);
    await loadAllProfilesInternal();
    await autoApplyMatchingProfile();
  }

  async function refreshAllProfiles(): Promise<void> {
    await loadAllProfilesInternal();
  }

  // Active config persistence effect

  $effect(() => {
    if (!configLoaded || !currentUrl) return;
    persistActiveConfig({ extraction, rules, applyToPreview }).catch((error) => {
      console.error('Failed to persist active extraction config', error);
    });
  });

  $effect(() => {
    autoApplyMatchingProfile();
  });

  return {
    // Config state
    get extraction() {
      return extraction;
    },
    get rules() {
      return rules;
    },
    set rules(value: SubRule[]) {
      rules = value;
    },
    get applyToPreview() {
      return applyToPreview;
    },
    get scope() {
      return scope;
    },

    // Profile state
    get activeProfileId() {
      return activeProfileId;
    },
    get activeProfile() {
      return activeProfile;
    },
    get autoAppliedProfile() {
      return autoAppliedProfile;
    },
    get ignoredProfileIds() {
      return ignoredProfileIds;
    },
    get hostProfiles() {
      return hostProfiles;
    },
    get allProfiles() {
      return allProfiles;
    },

    // URL modification tracking
    get urlModifications() {
      return urlModifications;
    },
    get modifiedUrls() {
      return modifiedUrls;
    },
    get previewCount() {
      return previewCount;
    },

    // Remote backup
    get remoteBackupMeta() {
      return remoteBackupMeta;
    },
    get backupLoading() {
      return backupLoading;
    },
    get backupStatusMessage() {
      return backupStatusMessage;
    },

    // UI state
    get profileSearch() {
      return profileSearch;
    },
    get profileNameDrafts() {
      return profileNameDrafts;
    },
    get statusMessage() {
      return statusMessage;
    },
    get storageWarning() {
      return storageWarning;
    },
    get importText() {
      return importText;
    },
    get importError() {
      return importError;
    },
    get isImporting() {
      return isImporting;
    },
    get isClearing() {
      return isClearing;
    },
    get isExporting() {
      return isExporting;
    },
    get isSaving() {
      return isSaving;
    },

    // Gallery
    get galleryDefaults() {
      return galleryDefaults;
    },

    // Lifecycle state
    get initialized() {
      return initialized;
    },
    get configLoaded() {
      return configLoaded;
    },

    // Derived
    get hasActiveFilters() {
      return hasActiveFilters();
    },
    get hasActiveRules() {
      return hasActiveRules();
    },
    get activeProfileDiffers() {
      return activeProfileDiffers();
    },
    get filteredProfiles() {
      return filteredProfiles();
    },

    // Config setters
    setExtractionMode,
    setStartSelector,
    setEndSelector,
    setContainerSource,
    setImageSource,
    setScope,
    setApplyToPreview,

    // Rule management
    addRule,
    updateRule,
    deleteRule,
    reorderRules,

    // Profile CRUD
    saveProfile,
    deleteProfile,
    deleteProfileById,
    applyProfile,
    renameProfile,
    ignoreProfile,

    // URL modification
    applyToSelected,
    resetModifications,
    clearModifications,
    calculatePreviewCount,

    // Import/export
    exportProfiles,
    importProfiles,
    clearProfiles,

    // Gallery defaults
    saveGalleryDefaults: saveGalleryDefaultsToStorage,
    clearActiveConfig,

    // Remote backup
    fetchBackupMeta,
    backupToRemote,
    restoreFromRemote,
    deleteRemoteBackup,

    // UI helpers
    setProfileSearch,
    setImportText,
    updateNameDraft,

    // Initialization
    initialize,
    refreshHostProfiles,
    refreshAllProfiles,
  };
}

export type ExtractionProfileStore = ReturnType<typeof createExtractionProfileStore>;
