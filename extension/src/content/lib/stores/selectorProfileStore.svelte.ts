/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { SvelteSet } from 'svelte/reactivity';
import type { ProfileScope, SavedSelectorProfile, SaveProfileInput } from '#utils/storageProfiles';
import {
  saveSelectorProfile,
  deleteSelectorProfile,
  loadSelectorProfiles,
  getProfilesForHost,
  getProfileForUrl,
  setPreferredScope as setPreferredScopeUtil,
  getPreferredScope,
  getSelectorStorageStatus,
  exportSelectorProfiles as exportProfilesUtil,
  importSelectorProfiles as importProfilesUtil,
  clearSelectorProfiles as clearProfilesUtil,
  renameSelectorProfile as renameProfileUtil,
} from '#utils/storageProfiles';
import { describeProfile } from '#utils/formatters';
import { fetchProfileBackup, saveProfileBackup, deleteProfileBackup } from '#utils/gdluxxApi';
import { validateServerUrl } from '#utils/persistence';
import { toastStore } from '#stores/toast';
import type { ProfileBackupData } from '#src/background/apiProxy';

export interface RemoteBackupMeta {
  hasBackup: boolean;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export function createSelectorProfileStore() {
  // Current selector state
  let scope = $state<ProfileScope>('host');
  let startSelector = $state('');
  let endSelector = $state('');
  let rangeHint = $state('');

  // Profile management
  let activeProfileId = $state<string | null>(null);
  let activeProfile = $state<SavedSelectorProfile | null>(null);
  let autoAppliedProfile = $state(false);
  let ignoredProfileIds = new SvelteSet<string>();

  // Profile lists
  let hostProfiles = $state<SavedSelectorProfile[]>([]);
  let allProfiles = $state<SavedSelectorProfile[]>([]);

  // UI state
  let profileSearch = $state('');
  const profileNameDrafts = $state<Record<string, string>>({});
  let statusMessage = $state<string | null>(null);
  let storageWarning = $state<string | null>(null);

  // Import/export state
  let importText = $state('');
  let importError = $state<string | null>(null);
  let isImporting = $state(false);
  let isClearing = $state(false);
  let isExporting = $state(false);
  let isSaving = $state(false);

  // Remote sync state
  let remoteBackupMeta = $state<RemoteBackupMeta | null>(null);
  let isLoadingRemoteBackup = $state(false);
  let isSavingRemoteBackup = $state(false);
  let isRestoringRemoteBackup = $state(false);
  let isDeletingRemoteBackup = $state(false);

  // Internal state
  let initialized = $state(false);
  let currentUrl = $state('');

  const hasActiveProfileValue = $derived(!!activeProfileId);
  const hasActiveFiltersValue = $derived(!!(startSelector.trim() || endSelector.trim()));
  const hasSelectorsValue = $derived(!!(startSelector.trim() || endSelector.trim()));

  const activeProfileDiffersValue = $derived(() => {
    if (!activeProfile) return false;
    return (
      activeProfile.startSelector !== startSelector || activeProfile.endSelector !== endSelector
    );
  });

  const filteredProfiles = $derived(() => {
    if (!profileSearch.trim()) return allProfiles;
    const search = profileSearch.toLowerCase();
    return allProfiles.filter((p) => {
      const name = p.name?.toLowerCase() || '';
      const host = p.host?.toLowerCase() || '';
      const origin = p.origin?.toLowerCase() || '';
      const path = p.path?.toLowerCase() || '';
      return (
        name.includes(search) ||
        host.includes(search) ||
        origin.includes(search) ||
        path.includes(search)
      );
    });
  });

  function setRemoteMeta(payload: ProfileBackupData | null) {
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

  function getCurrentScopeInput(scopeOverride?: ProfileScope): SaveProfileInput {
    const scopeToUse = scopeOverride ?? scope;
    if (typeof window === 'undefined') {
      return {
        scope: scopeToUse,
        host: '',
        origin: '',
        path: '/',
        startSelector,
        endSelector,
      };
    }
    const url = new URL(currentUrl);
    return {
      scope: scopeToUse,
      host: url.hostname,
      origin: url.origin,
      path: url.pathname,
      startSelector,
      endSelector,
    };
  }

  function buildProfileMessage(profile: SavedSelectorProfile): string {
    return describeProfile(profile);
  }

  function persistIgnoredProfileIds(ids: SvelteSet<string>) {
    try {
      sessionStorage.setItem('gdluxx_ignored_selector_profiles', JSON.stringify([...ids]));
    } catch {
      // Ignore
    }
  }

  function loadIgnoredProfileIds(): SvelteSet<string> {
    try {
      const stored = sessionStorage.getItem('gdluxx_ignored_selector_profiles');
      if (stored) {
        const ids = JSON.parse(stored);
        return new SvelteSet(Array.isArray(ids) ? ids : []);
      }
    } catch {
      // Ignore
    }
    return new SvelteSet();
  }

  function setScope(newScope: ProfileScope) {
    scope = newScope;
  }

  function setStartSelector(value: string) {
    startSelector = value;
  }

  function setEndSelector(value: string) {
    endSelector = value;
  }

  function setRangeHint(value: string) {
    rangeHint = value;
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

  async function saveProfile(scopeOverride?: ProfileScope): Promise<void> {
    if (!hasSelectorsValue) {
      toastStore.warning('Enter a start or end selector before saving.');
      return;
    }
    if (isSaving) return;
    isSaving = true;

    const scopeToUse = scopeOverride ?? scope;
    try {
      const payload = getCurrentScopeInput(scopeToUse);
      const { profile, id } = await saveSelectorProfile(payload);
      activeProfileId = id;
      activeProfile = profile;
      scope = scopeToUse;
      statusMessage = buildProfileMessage(profile);
      autoAppliedProfile = false;

      const nextIgnored = new SvelteSet(ignoredProfileIds);
      if (nextIgnored.has(id)) {
        nextIgnored.delete(id);
        ignoredProfileIds = nextIgnored;
        persistIgnoredProfileIds(nextIgnored);
      }

      await setPreferredScopeUtil(scopeToUse);
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
      toastStore.success('Saved range selectors for this site.');
    } catch (error) {
      console.error('Failed to save selector profile', error);
      toastStore.error('Failed to save selectors.');
    } finally {
      isSaving = false;
    }
  }

  async function deleteProfile(): Promise<void> {
    if (!activeProfileId) return;
    if (!confirm('Remove the saved selectors for this site?')) return;

    try {
      await deleteSelectorProfile(activeProfileId);
      const nextIgnored = new SvelteSet(ignoredProfileIds);
      nextIgnored.delete(activeProfileId);
      ignoredProfileIds = nextIgnored;
      persistIgnoredProfileIds(nextIgnored);

      startSelector = '';
      endSelector = '';
      activeProfileId = null;
      activeProfile = null;
      statusMessage = null;
      autoAppliedProfile = false;

      toastStore.success('Saved selectors removed.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to delete selector profile', error);
      toastStore.error('Failed to delete saved selectors.');
    }
  }

  async function deleteProfileById(id: string): Promise<void> {
    try {
      await deleteSelectorProfile(id);
      const nextIgnored = new SvelteSet(ignoredProfileIds);
      nextIgnored.delete(id);
      ignoredProfileIds = nextIgnored;
      persistIgnoredProfileIds(nextIgnored);

      if (activeProfileId === id) {
        activeProfileId = null;
        activeProfile = null;
        statusMessage = null;
        autoAppliedProfile = false;
      }

      toastStore.success('Profile deleted.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to delete selector profile', error);
      toastStore.error('Failed to delete profile.');
    }
  }

  async function applyProfile(id: string): Promise<void> {
    const profile = hostProfiles.find((p) => p.id === id);
    if (!profile) return;

    startSelector = profile.startSelector;
    endSelector = profile.endSelector;
    activeProfileId = profile.id;
    activeProfile = profile;
    scope = profile.scope;
    statusMessage = buildProfileMessage(profile);
    autoAppliedProfile = false;

    const next = new SvelteSet(ignoredProfileIds);
    if (next.has(profile.id)) {
      next.delete(profile.id);
      ignoredProfileIds = next;
      persistIgnoredProfileIds(next);
    }

    toastStore.success('Applied saved selectors.');
    await refreshHostProfiles(currentUrl);
    await loadAllProfilesInternal();
  }

  async function renameProfile(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const existing = allProfiles.find((p) => p.id === id);
    if (existing && (existing.name ?? '') === trimmed) return;

    try {
      await renameProfileUtil(id, trimmed);
      toastStore.success('Renamed selector profile.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to rename selector profile', error);
      toastStore.error('Failed to rename profile.');
    }
  }

  function ignoreProfile(): void {
    if (!activeProfileId) return;
    const next = new SvelteSet(ignoredProfileIds);
    next.add(activeProfileId);
    ignoredProfileIds = next;
    persistIgnoredProfileIds(next);

    statusMessage = 'Saved selectors ignored for this session.';
    activeProfileId = null;
    activeProfile = null;
    autoAppliedProfile = false;
    toastStore.info('Saved selectors will be ignored until you reload the page.');
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
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const stamp = new Date().toISOString().replace(/[:]/g, '-');
      a.download = `gdluxx-saved-selectors-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastStore.success('Exported saved selector profiles.');
    } catch (error) {
      console.error('Failed to export selector profiles', error);
      toastStore.error('Failed to export profiles.');
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
      toastStore.success('Imported selector profiles.');
      importText = '';
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to import selector profiles', error);
      importError =
        error instanceof Error ? error.message : 'Unknown error while importing profiles';
      toastStore.error('Failed to import profiles.');
    } finally {
      isImporting = false;
    }
  }

  async function clearProfiles(): Promise<void> {
    if (isClearing) return;
    if (!confirm('Clear all saved selector profiles?')) return;

    isClearing = true;

    try {
      await clearProfilesUtil();
      activeProfileId = null;
      activeProfile = null;
      statusMessage = null;
      autoAppliedProfile = false;

      const cleared = new SvelteSet<string>();
      ignoredProfileIds = cleared;
      persistIgnoredProfileIds(cleared);

      toastStore.success('Cleared all saved selector profiles.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
    } catch (error) {
      console.error('Failed to clear selector profiles', error);
      toastStore.error('Failed to clear profiles.');
    } finally {
      isClearing = false;
    }
  }

  async function refreshRemoteBackupMeta(
    serverUrl: string,
    apiKey: string,
    showToast = false,
  ): Promise<{ success: boolean; error?: string }> {
    if (!ensureConfiguredForRemote(serverUrl, apiKey, showToast)) {
      remoteBackupMeta = null;
      return { success: false, error: 'Not configured' };
    }
    if (isLoadingRemoteBackup) return { success: false, error: 'Already loading' };

    isLoadingRemoteBackup = true;
    try {
      const res = await fetchProfileBackup(serverUrl, apiKey);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (showToast && res.message) {
          toastStore.info(res.message);
        }
        return { success: true };
      } else {
        setRemoteMeta(null);
        if (showToast) {
          toastStore.error(res.error ?? 'Failed to load remote backup');
        }
        return { success: false, error: res.error };
      }
    } catch (error) {
      console.error('Failed to fetch remote backup metadata', error);
      setRemoteMeta(null);
      if (showToast) {
        toastStore.error('Failed to reach gdluxx for backup status.');
      }
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    } finally {
      isLoadingRemoteBackup = false;
    }
  }

  async function backupToRemote(
    serverUrl: string,
    apiKey: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (isSavingRemoteBackup) {
      toastStore.warning('Remote operation already in progress');
      return { success: false, error: 'Operation in progress' };
    }
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) {
      return { success: false, error: 'Not configured' };
    }

    isSavingRemoteBackup = true;
    try {
      const bundle = await exportProfilesUtil();
      const res = await saveProfileBackup(serverUrl, apiKey, bundle);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (res.message) {
          toastStore.success(res.message);
        } else {
          toastStore.success('Backed up selector profiles to gdluxx.');
        }
        return { success: true };
      } else {
        toastStore.error(res.error ?? 'Failed to backup profiles to gdluxx.');
        return { success: false, error: res.error };
      }
    } catch (error) {
      console.error('Failed to backup selector profiles to gdluxx', error);
      toastStore.error('Failed to backup profiles to gdluxx.');
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    } finally {
      isSavingRemoteBackup = false;
    }
  }

  async function restoreFromRemote(
    serverUrl: string,
    apiKey: string,
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    if (isRestoringRemoteBackup) {
      toastStore.warning('Remote operation already in progress');
      return { success: false, error: 'Operation in progress' };
    }
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) {
      return { success: false, error: 'Not configured' };
    }

    isRestoringRemoteBackup = true;
    try {
      const res = await fetchProfileBackup(serverUrl, apiKey);
      if (!res.success || !res.data) {
        toastStore.error(res.error ?? 'Failed to load remote backup.');
        return { success: false, error: res.error };
      }

      setRemoteMeta(res.data);
      if (!res.data.hasBackup) {
        toastStore.info('No remote backup found for this API key.');
        return { success: false, error: 'No backup found' };
      }

      await importProfilesUtil(res.data.bundle);
      toastStore.success(res.message ?? 'Restored selector profiles from gdluxx.');
      await refreshHostProfiles(currentUrl);
      await loadAllProfilesInternal();
      return { success: true, count: res.data.profileCount };
    } catch (error) {
      console.error('Failed to restore selector profiles from gdluxx', error);
      toastStore.error('Failed to restore profiles from gdluxx.');
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    } finally {
      isRestoringRemoteBackup = false;
    }
  }

  async function deleteRemoteBackup(
    serverUrl: string,
    apiKey: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (isDeletingRemoteBackup) {
      toastStore.warning('Remote operation already in progress');
      return { success: false, error: 'Operation in progress' };
    }
    if (!ensureConfiguredForRemote(serverUrl, apiKey)) {
      return { success: false, error: 'Not configured' };
    }
    if (!confirm('Remove the remote range profile backup from gdluxx?')) {
      return { success: false, error: 'Cancelled' };
    }

    isDeletingRemoteBackup = true;
    try {
      const res = await deleteProfileBackup(serverUrl, apiKey);
      if (res.success && res.data) {
        if (res.data.deleted) {
          setRemoteMeta(null);
        }
        if (res.message) {
          toastStore.success(res.message);
        } else if (res.data.deleted) {
          toastStore.success('Removed remote backup.');
        } else {
          toastStore.info('No remote backup to delete.');
        }
        return { success: true };
      } else {
        toastStore.error(res.error ?? 'Failed to delete remote backup.');
        return { success: false, error: res.error };
      }
    } catch (error) {
      console.error('Failed to delete remote selector profile backup', error);
      toastStore.error('Failed to delete remote backup.');
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
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
      const profiles = await getProfilesForHost(url);
      hostProfiles = profiles;
    } catch (error) {
      console.error('Failed to load host profiles', error);
      hostProfiles = [];
    }
  }

  async function loadAllProfilesInternal(): Promise<void> {
    try {
      const profiles = await loadSelectorProfiles();
      allProfiles = profiles;
    } catch (error) {
      console.error('Failed to load all profiles', error);
      allProfiles = [];
    }
  }

  async function initialize(url: string): Promise<void> {
    const urlChanged = currentUrl !== url;

    if (initialized && !urlChanged) return;

    currentUrl = url;

    if (!initialized) {
      ignoredProfileIds = loadIgnoredProfileIds();

      try {
        const preferredScope = await getPreferredScope();
        scope = preferredScope ?? 'host';
      } catch {
        scope = 'host';
      }

      try {
        const status = await getSelectorStorageStatus();
        if (status.degraded) {
          storageWarning = status.error ?? 'Storage is degraded';
        }
      } catch {
        // Ignore
      }

      initialized = true;
    }

    await refreshHostProfiles(url);
    await loadAllProfilesInternal();

    await autoApplyMatchingProfile();
  }

  async function autoApplyMatchingProfile() {
    if (!initialized || !currentUrl) return;

    // Don't auto-apply if we have an active profile that's not ignored
    if (activeProfileId && !ignoredProfileIds.has(activeProfileId)) return;

    try {
      const match = await getProfileForUrl(currentUrl);
      if (match && !ignoredProfileIds.has(match.id)) {
        startSelector = match.profile.startSelector;
        endSelector = match.profile.endSelector;
        activeProfileId = match.id;
        activeProfile = match.profile;
        scope = match.profile.scope;
        statusMessage = buildProfileMessage(match.profile);
        autoAppliedProfile = true;
      }
    } catch (error) {
      console.error('Failed to auto-apply profile', error);
    }
  }

  $effect(() => {
    autoApplyMatchingProfile();
  });

  return {
    // Read-only state
    get scope() {
      return scope;
    },
    get startSelector() {
      return startSelector;
    },
    get endSelector() {
      return endSelector;
    },
    get rangeHint() {
      return rangeHint;
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
    get ignoredProfileIds() {
      return ignoredProfileIds;
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

    // Derived
    get hasActiveProfile() {
      return hasActiveProfileValue;
    },
    get hasActiveFilters() {
      return hasActiveFiltersValue;
    },
    get activeProfileDiffers() {
      return activeProfileDiffersValue();
    },
    get hasSelectors() {
      return hasSelectorsValue;
    },
    get filteredProfiles() {
      return filteredProfiles();
    },

    // Mutations
    setScope,
    setStartSelector,
    setEndSelector,
    setRangeHint,
    setProfileSearch,
    setImportText,
    updateNameDraft,

    // CRUD operations
    saveProfile,
    deleteProfile,
    deleteProfileById,
    applyProfile,
    renameProfile,
    ignoreProfile,

    // Import/export
    exportProfiles,
    importProfiles,
    clearProfiles,

    // Remote sync
    refreshRemoteBackupMeta,
    backupToRemote,
    restoreFromRemote,
    deleteRemoteBackup,

    // Initialization
    initialize,
    refreshHostProfiles,
  };
}

export type SelectorProfileStore = ReturnType<typeof createSelectorProfileStore>;
