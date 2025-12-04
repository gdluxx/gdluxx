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
import {
  clearSubProfiles,
  deleteSubProfile,
  exportSubProfiles as exportProfilesUtil,
  getAutoApplySubDefault,
  getPreferredSubScope,
  getSubProfileForUrl,
  getSubProfilesForHost,
  getSubStorageStatus,
  importSubProfiles as importProfilesUtil,
  loadActiveSubRules,
  loadSubProfiles,
  persistActiveSubRules,
  renameSubProfile as renameProfileUtil,
  saveSubProfile,
  setAutoApplySubDefault,
  setPreferredSubScope,
  type SavedSubProfile,
  type SaveSubProfileInput,
} from '#utils/storageSubstitution';
import { applySubRules, createSubRule, type SubResult, type SubRule } from '#utils/substitution';
import {
  validateServerUrl,
  persistIgnoredSubProfileIds,
  readIgnoredSubProfileIds,
} from '#utils/persistence';
import {
  deleteSubBackup,
  fetchSubBackup,
  saveSubBackup,
  type SubBackupPayload,
} from '#utils/messaging';
import type { ProfileScope } from '#utils/storageProfiles';

export interface SubRemoteBackupMeta {
  hasBackup: boolean;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

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

export function createSubstitutionStore() {
  let rules = $state<SubRule[]>([]);
  let expanded = $state(false);
  let applyToPreview = $state(false);
  let applyDefaultSub = $state(true);
  let rulesLoaded = $state(false);

  let scope = $state<ProfileScope>('host');
  let activeProfileId = $state<string | null>(null);
  let activeProfile = $state<SavedSubProfile | null>(null);
  let autoAppliedProfile = $state(false);
  let hostProfiles = $state<SavedSubProfile[]>([]);
  let allProfiles = $state<SavedSubProfile[]>([]);
  let profileSearch = $state('');
  let profileNameDrafts = $state<Record<string, string>>({});
  let statusMessage = $state<string | null>(null);
  let storageWarning = $state<string | null>(null);

  let importText = $state('');
  let importError = $state<string | null>(null);
  let isImporting = $state(false);
  let isClearing = $state(false);
  let isExporting = $state(false);
  let isSaving = $state(false);

  let remoteBackupMeta = $state<SubRemoteBackupMeta | null>(null);
  let isLoadingRemoteBackup = $state(false);
  let isSavingRemoteBackup = $state(false);
  let isRestoringRemoteBackup = $state(false);
  let isDeletingRemoteBackup = $state(false);

  const ignoredProfileIds = new SvelteSet<string>();
  const urlModifications = new SvelteMap<string, SubResult>();
  const modifiedUrls = new SvelteSet<string>();
  let previewCount = $state(0);

  let initialized = $state(false);
  let currentUrl = $state('');

  const hasActiveSubs = $derived(() =>
    rules.some((rule) => rule.enabled && rule.pattern.trim().length > 0),
  );
  const hasSubRules = $derived(() => rules.length > 0);
  const activeProfileDiffers = $derived(() => {
    if (!activeProfile) return false;
    if (activeProfile.applyToPreview !== applyToPreview) return true;
    return rulesDifferFromProfile(activeProfile.rules, rules);
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
        `${profile.rules.length}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return parts.includes(query);
    });
  });

  function rulesDifferFromProfile(profileRules: SubRule[], currentRules: SubRule[]): boolean {
    if (profileRules.length !== currentRules.length) {
      return true;
    }
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

  function buildProfileMessage(profile: SavedSubProfile): string {
    const ruleCount = profile.rules.length;
    const ruleText = ruleCount === 1 ? 'rule' : 'rules';
    if (profile.scope === 'path' && profile.path) {
      return `Using substitution (${ruleCount} ${ruleText}) for ${profile.host}${profile.path}`;
    }
    if (profile.scope === 'origin' && profile.origin) {
      return `Using substitution (${ruleCount} ${ruleText}) for ${profile.origin}`;
    }
    return `Using substitution (${ruleCount} ${ruleText}) for ${profile.host}`;
  }

  function setIgnored(next: ReadonlySet<string>) {
    ignoredProfileIds.clear();
    for (const value of next) {
      ignoredProfileIds.add(value);
    }
  }

  function ensureConfiguredForRemote(serverUrl: string, apiKey: string, showToast = true): boolean {
    const hasUrl = !!serverUrl;
    const hasKey = !!apiKey;
    if (!hasUrl || !hasKey) {
      if (showToast) {
        toastStore.error('Configure your gdluxx server URL and API key first.');
      }
      return false;
    }
    const { valid, error } = validateServerUrl(serverUrl);
    if (!valid) {
      if (showToast) {
        toastStore.error(error ?? 'Invalid server URL');
      }
      return false;
    }
    return true;
  }

  function getCurrentScopeInput(scopeOverride?: ProfileScope): SaveSubProfileInput {
    const scopeToUse = scopeOverride ?? scope;
    if (typeof window === 'undefined') {
      return {
        scope: scopeToUse,
        host: '',
        origin: '',
        path: '/',
        rules,
        applyToPreview,
      };
    }
    const { hostname, origin, pathname } = window.location;
    return {
      scope: scopeToUse,
      host: hostname,
      origin,
      path: pathname,
      rules,
      applyToPreview,
    };
  }

  function setRules(nextRules: SubRule[]) {
    rules = nextRules;
  }

  function addRule() {
    rules = [...rules, createSubRule('', '', 'g', rules.length)];
  }

  function deleteRule(id: string) {
    rules = rules.filter((rule) => rule.id !== id);
  }

  function updateRule(id: string, updates: Partial<SubRule>) {
    rules = rules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
  }

  function reorderRules(newOrder: SubRule[]) {
    rules = newOrder.map((rule, index) => ({ ...rule, order: index }));
  }

  function setExpanded(value: boolean) {
    expanded = value;
  }

  function setScope(value: ProfileScope) {
    scope = value;
  }

  function setApplyToPreview(value: boolean) {
    applyToPreview = value;
  }

  function setApplyDefault(value: boolean) {
    applyDefaultSub = value;
    setAutoApplySubDefault(value).catch((error) => {
      console.error('Failed to persist replacement auto-apply preference', error);
    });
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

  function applyToSelected(
    selectedUrls: string[],
    links: string[],
    images: string[],
    linkCounts: Record<string, number>,
    imageCounts: Record<string, number>,
  ): ApplyResult {
    if (!hasActiveSubs) {
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
      if (!result.modified) {
        continue;
      }

      const existingModification = urlModifications.get(url);
      if (existingModification) {
        result.initialUrl = existingModification.initialUrl;
        updateModificationTracking(url, null);
      }

      const revertedToInitial =
        existingModification && result.modifiedUrl === existingModification.initialUrl;

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

    if (linksChanged) {
      links = nextLinks;
    }
    if (imagesChanged) {
      images = nextImages;
    }
    if (linkCountsChanged) {
      linkCounts = nextLinkCounts;
    }
    if (imageCountsChanged) {
      imageCounts = nextImageCounts;
    }

    if (!pendingModifications.size && !pendingModifiedUrls.size) {
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

    return {
      links,
      images,
      linkCounts,
      imageCounts,
      newSelection: nextSelected,
      modifiedCount,
    };
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

    for (const [currentUrl, result] of urlModifications) {
      const imageIndex = images.indexOf(currentUrl);
      if (imageIndex !== -1) {
        nextImages[imageIndex] = result.initialUrl;
        imagesChanged = true;
        if (nextImageCounts[currentUrl]) {
          nextImageCounts[result.initialUrl] = nextImageCounts[currentUrl];
          delete nextImageCounts[currentUrl];
          imageCountsChanged = true;
        }
      }

      const linkIndex = links.indexOf(currentUrl);
      if (linkIndex !== -1) {
        nextLinks[linkIndex] = result.initialUrl;
        linksChanged = true;
        if (nextLinkCounts[currentUrl]) {
          nextLinkCounts[result.initialUrl] = nextLinkCounts[currentUrl];
          delete nextLinkCounts[currentUrl];
          linkCountsChanged = true;
        }
      }

      nextSelected.add(result.initialUrl);
    }

    if (linksChanged) {
      links = nextLinks;
    }
    if (imagesChanged) {
      images = nextImages;
    }
    if (linkCountsChanged) {
      linkCounts = nextLinkCounts;
    }
    if (imageCountsChanged) {
      imageCounts = nextImageCounts;
    }

    urlModifications.clear();
    modifiedUrls.clear();
    toastStore.info('All modifications reset');

    return {
      links,
      images,
      linkCounts,
      imageCounts,
      newSelection: nextSelected,
    };
  }

  function clearModifications() {
    urlModifications.clear();
    modifiedUrls.clear();
    previewCount = 0;
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

  function calculatePreviewCount(selectedUrls: string[]): number {
    if (!hasActiveSubs) {
      previewCount = 0;
      return previewCount;
    }
    if (!selectedUrls.length) {
      previewCount = 0;
      return previewCount;
    }
    let count = 0;
    for (const url of selectedUrls) {
      if (applySubRules(url, rules).modified) {
        count += 1;
      }
    }
    previewCount = count;
    return previewCount;
  }

  async function saveProfile(scopeOverride?: ProfileScope): Promise<void> {
    if (!hasSubRules) {
      toastStore.warning('Add at least one substitution rule before saving.');
      return;
    }
    if (isSaving) return;
    isSaving = true;
    const scopeToUse = scopeOverride ?? scope;
    try {
      const payload = getCurrentScopeInput(scopeToUse);
      const { profile, id } = await saveSubProfile(payload);
      activeProfileId = id;
      activeProfile = profile;
      scope = scopeToUse;
      rules = profile.rules.slice().sort((a, b) => a.order - b.order);
      applyToPreview = profile.applyToPreview;
      statusMessage = buildProfileMessage(profile);
      autoAppliedProfile = false;

      const nextIgnored = new SvelteSet(ignoredProfileIds);
      if (nextIgnored.has(id)) {
        nextIgnored.delete(id);
        setIgnored(nextIgnored);
        persistIgnoredSubProfileIds(nextIgnored);
      }

      await setPreferredSubScope(scopeToUse);
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
      toastStore.success('Saved substitution profile for this site.');
    } catch (error) {
      console.error('Failed to save substitution profile', error);
      toastStore.error('Failed to save replacement profile.');
    } finally {
      isSaving = false;
    }
  }

  async function deleteProfile(): Promise<void> {
    if (!activeProfileId) return;
    if (!confirm('Remove the saved substitution profile for this site?')) return;
    try {
      await deleteSubProfile(activeProfileId);
      const nextIgnored = new SvelteSet(ignoredProfileIds);
      nextIgnored.delete(activeProfileId);
      setIgnored(nextIgnored);
      persistIgnoredSubProfileIds(nextIgnored);
      activeProfileId = null;
      activeProfile = null;
      statusMessage = null;
      autoAppliedProfile = false;
      toastStore.success('Substitution profile removed.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to delete substitution profile', error);
      toastStore.error('Failed to delete replacement profile.');
    }
  }

  async function deleteProfileById(id: string): Promise<void> {
    if (!confirm('Delete this saved substitution profile?')) return;
    try {
      await deleteSubProfile(id);
      if (activeProfileId === id) {
        activeProfileId = null;
        activeProfile = null;
        statusMessage = null;
        autoAppliedProfile = false;
      }
      const next = new SvelteSet(ignoredProfileIds);
      if (next.delete(id)) {
        setIgnored(next);
        persistIgnoredSubProfileIds(next);
      }
      toastStore.success('Deleted saved substitution profile.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to delete substitution profile', error);
      toastStore.error('Failed to delete replacement profile.');
    }
  }

  async function applyProfile(id: string): Promise<void> {
    await refreshHostProfiles(currentUrl);
    await loadAllProfilesInternal();

    const profile = hostProfiles.find((p) => p.id === id) ?? allProfiles.find((p) => p.id === id);
    if (!profile) return;
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
      persistIgnoredSubProfileIds(next);
    }
    toastStore.success('Applied substitution profile.');
  }

  async function renameProfile(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = allProfiles.find((p) => p.id === id);
    if (existing && (existing.name ?? '') === trimmed) return;
    try {
      await renameProfileUtil(id, trimmed);
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to rename replacement profile', error);
      toastStore.error('Failed to rename replacement profile.');
    }
  }

  function ignoreProfile(): void {
    if (!activeProfileId) return;
    const next = new SvelteSet(ignoredProfileIds);
    next.add(activeProfileId);
    setIgnored(next);
    persistIgnoredSubProfileIds(next);
    statusMessage = 'Saved substitution profile ignored for this session.';
    activeProfileId = null;
    activeProfile = null;
    autoAppliedProfile = false;
    toastStore.info('Saved substitution profile will be ignored until you reload the page.');
  }

  async function exportProfiles(): Promise<void> {
    if (isExporting) return;
    isExporting = true;
    try {
      const bundle = await exportProfilesUtil();
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new SvelteDate().toISOString().replace(/[:]/g, '-');
      a.download = `gdluxx-substitution-profiles-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastStore.success('Exported substitution profiles.');
    } catch (error) {
      console.error('Failed to export replacement profiles', error);
      toastStore.error('Failed to export replacement profiles.');
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
      const payload = JSON.parse(importText);
      await importProfilesUtil(payload);
      toastStore.success('Imported substitution profiles.');
      importText = '';
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to import replacement profiles', error);
      importError =
        error instanceof Error ? error.message : 'Unknown error while importing profiles';
      toastStore.error('Failed to import replacement profiles.');
    } finally {
      isImporting = false;
    }
  }

  async function clearProfiles(): Promise<void> {
    if (isClearing) return;
    if (!confirm('Clear all saved substitution profiles?')) return;
    isClearing = true;
    try {
      await clearSubProfiles();
      activeProfileId = null;
      activeProfile = null;
      statusMessage = null;
      autoAppliedProfile = false;
      const cleared = new SvelteSet<string>();
      setIgnored(cleared);
      persistIgnoredSubProfileIds(cleared);
      toastStore.success('Cleared all saved substitution profiles.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to clear replacement profiles', error);
      toastStore.error('Failed to clear replacement profiles.');
    } finally {
      isClearing = false;
    }
  }

  function setRemoteMeta(payload: SubBackupPayload | null) {
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

  async function refreshRemoteBackupMeta(
    serverUrl: string,
    apiKey: string,
    showToast = false,
  ): Promise<void> {
    if (!ensureConfiguredForRemote(serverUrl, apiKey, showToast)) {
      remoteBackupMeta = null;
      return;
    }
    if (isLoadingRemoteBackup) return;
    isLoadingRemoteBackup = true;
    try {
      const res = await fetchSubBackup(serverUrl, apiKey);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (showToast && res.message) {
          toastStore.info(res.message);
        }
      } else {
        setRemoteMeta(null);
        if (showToast) {
          toastStore.error(res.error ?? 'Failed to load substitution backup');
        }
      }
    } catch (error) {
      console.error('Failed to fetch substitution remote backup metadata', error);
      setRemoteMeta(null);
      if (showToast) {
        toastStore.error('Failed to reach gdluxx for substitution backup status.');
      }
    } finally {
      isLoadingRemoteBackup = false;
    }
  }

  async function backupToRemote(serverUrl: string, apiKey: string): Promise<void> {
    if (isSavingRemoteBackup) return;
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) return;
    isSavingRemoteBackup = true;
    try {
      const bundle = await exportProfilesUtil();
      const res = await saveSubBackup(serverUrl, apiKey, bundle);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (res.message) {
          toastStore.success(res.message);
        } else {
          toastStore.success('Backed up substitution profiles to gdluxx.');
        }
      } else {
        toastStore.error(res.error ?? 'Failed to backup substitution profiles to gdluxx.');
      }
    } catch (error) {
      console.error('Failed to backup replacement profiles to gdluxx', error);
      toastStore.error('Failed to backup substitution profiles to gdluxx.');
    } finally {
      isSavingRemoteBackup = false;
    }
  }

  async function restoreFromRemote(serverUrl: string, apiKey: string): Promise<void> {
    if (isRestoringRemoteBackup) return;
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) return;
    isRestoringRemoteBackup = true;
    try {
      const res = await fetchSubBackup(serverUrl, apiKey);
      if (!res.success || !res.data) {
        toastStore.error(res.error ?? 'Failed to load substitution backup.');
        return;
      }
      setRemoteMeta(res.data);
      if (!res.data.hasBackup) {
        toastStore.info('No remote substitution backup found for this API key.');
        return;
      }
      await importProfilesUtil(res.data.bundle);
      toastStore.success('Restored substitution profiles from gdluxx.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to restore replacement profiles from gdluxx', error);
      toastStore.error('Failed to restore replacement profiles from gdluxx.');
    } finally {
      isRestoringRemoteBackup = false;
    }
  }

  async function deleteRemoteBackup(serverUrl: string, apiKey: string): Promise<void> {
    if (isDeletingRemoteBackup) return;
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) return;
    isDeletingRemoteBackup = true;
    try {
      const res = await deleteSubBackup(serverUrl, apiKey);
      if (res.success && res.data) {
        if (res.data.deleted) {
          toastStore.success('Removed remote substitution backup.');
        } else {
          toastStore.info('No remote substitution backup to delete.');
        }
        setRemoteMeta(null);
      } else {
        toastStore.error(res.error ?? 'Failed to delete remote substitution backup.');
      }
    } catch (error) {
      console.error('Failed to delete remote replacement profile backup', error);
      toastStore.error('Failed to delete remote substitution backup.');
    } finally {
      isDeletingRemoteBackup = false;
    }
  }

  async function refreshHostProfiles(url: string): Promise<void> {
    if (!url) {
      hostProfiles = [];
      return;
    }
    try {
      const list = await getSubProfilesForHost(new URL(url).hostname);
      hostProfiles = list;
    } catch {
      hostProfiles = [];
    }
  }

  async function loadAllProfilesInternal(): Promise<void> {
    try {
      const list = await loadSubProfiles();
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
      console.error('Failed to load replacement profiles', error);
      allProfiles = [];
      profileNameDrafts = {};
    }
  }

  async function initialize(url: string): Promise<void> {
    const urlChanged = currentUrl !== url;

    if (initialized && !urlChanged) return;

    currentUrl = url;

    try {
      const storedRules = await loadActiveSubRules();
      if (storedRules.length) {
        rules = storedRules.sort((a, b) => a.order - b.order);
      } else {
        rules = [createSubRule('', '', 'g', 0)];
      }
    } catch (error) {
      console.error('Failed to load replacement rules', error);
      rules = [createSubRule('', '', 'g', 0)];
    } finally {
      rulesLoaded = true;
    }

    try {
      const pref = await getPreferredSubScope();
      if (pref) scope = pref;
    } catch {
      // Ignore
    }

    try {
      const status = await getSubStorageStatus();
      storageWarning = status.degraded
        ? (status.error ?? 'Substitution profile storage degraded')
        : null;
    } catch {
      storageWarning = 'Substitution profile storage unavailable';
    }

    try {
      applyDefaultSub = await getAutoApplySubDefault();
    } catch {
      applyDefaultSub = true;
    }

    const ignored = readIgnoredSubProfileIds();
    setIgnored(ignored);

    await refreshHostProfiles(url);
    await loadAllProfilesInternal();

    await autoApplyMatchingProfile();

    initialized = true;
  }

  async function autoApplyMatchingProfile() {
    if (!initialized || !currentUrl) return;

    if (activeProfileId && !ignoredProfileIds.has(activeProfileId)) return;

    if (!applyDefaultSub) return;

    try {
      const match = await getSubProfileForUrl(currentUrl);
      if (match && !ignoredProfileIds.has(match.id)) {
        activeProfileId = match.id;
        activeProfile = match.profile;
        rules = match.profile.rules.slice().sort((a, b) => a.order - b.order);
        applyToPreview = match.profile.applyToPreview;
        statusMessage = buildProfileMessage(match.profile);
        autoAppliedProfile = true;
      }
    } catch (error) {
      console.error('Failed to auto-apply substitution profile', error);
    }
  }

  $effect(() => {
    if (!rulesLoaded || !currentUrl) return;
    persistActiveSubRules(rules).catch((error) => {
      console.error('Failed to persist replacement rules', error);
    });
  });

  $effect(() => {
    autoApplyMatchingProfile();
  });

  return {
    get rules() {
      return rules;
    },
    set rules(value: SubRule[]) {
      setRules(value);
    },
    get expanded() {
      return expanded;
    },
    get applyToPreview() {
      return applyToPreview;
    },
    get applyDefaultSub() {
      return applyDefaultSub;
    },
    get scope() {
      return scope;
    },
    get activeProfileId() {
      return activeProfileId;
    },
    get activeProfile() {
      return activeProfile;
    },
    get autoAppliedProfile() {
      return autoAppliedProfile;
    },
    get hostProfiles() {
      return hostProfiles;
    },
    get allProfiles() {
      return allProfiles;
    },
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
    get remoteBackupMeta() {
      return remoteBackupMeta;
    },
    get isLoadingRemoteBackup() {
      return isLoadingRemoteBackup;
    },
    get isSavingRemoteBackup() {
      return isSavingRemoteBackup;
    },
    get isRestoringRemoteBackup() {
      return isRestoringRemoteBackup;
    },
    get isDeletingRemoteBackup() {
      return isDeletingRemoteBackup;
    },
    get ignoredProfileIds() {
      return ignoredProfileIds;
    },
    get urlModifications() {
      return urlModifications;
    },
    get modifiedUrls() {
      return modifiedUrls;
    },
    get previewCount() {
      return previewCount;
    },
    get hasActiveSubs() {
      return hasActiveSubs();
    },
    get hasSubRules() {
      return hasSubRules();
    },
    get activeProfileDiffers() {
      return activeProfileDiffers();
    },
    get filteredProfiles() {
      return filteredProfiles();
    },

    setRules,
    addRule,
    deleteRule,
    updateRule,
    reorderRules,
    setExpanded,
    setScope,
    setApplyToPreview,
    setApplyDefault,
    setProfileSearch,
    setImportText,
    updateNameDraft,
    applyToSelected,
    resetModifications,
    clearModifications,
    calculatePreviewCount,
    saveProfile,
    deleteProfile,
    deleteProfileById,
    applyProfile,
    renameProfile,
    ignoreProfile,
    exportProfiles,
    importProfiles,
    clearProfiles,
    refreshRemoteBackupMeta,
    backupToRemote,
    restoreFromRemote,
    deleteRemoteBackup,
    initialize,
    refreshHostProfiles,
    refreshAllProfiles: loadAllProfilesInternal,
  };
}

export type SubstitutionStore = ReturnType<typeof createSubstitutionStore>;
