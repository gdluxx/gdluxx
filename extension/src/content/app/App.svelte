<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  /* eslint-env browser */
  /* global Event, HTMLSelectElement */
  import { extractAll } from '#utils/extract';
  import { setClipboard } from '#utils/clipboard';
  import {
    saveSettings,
    validateServerUrl,
    readIgnoredProfileIds,
    persistIgnoredProfileIds,
  } from '#utils/persistence';
  import {
    sendUrls,
    testConnection,
    fetchProfileBackup,
    saveProfileBackup,
    deleteProfileBackup,
    type ProfileBackupPayload,
  } from '#utils/messaging';
  import { Icon } from '#components/ui';
  import { ToastContainer } from '#components/ui';
  import { toastStore } from '#stores/toast';
  import {
    getProfileForUrl,
    saveSelectorProfile,
    deleteSelectorProfile,
    getProfilesForHost,
    getSelectorStorageStatus,
    getPreferredScope,
    setPreferredScope,
    loadSelectorProfiles,
    exportSelectorProfiles,
    importSelectorProfiles,
    clearSelectorProfiles,
    renameSelectorProfile,
    type ProfileScope,
    type SavedSelectorProfile,
  } from '#utils/storageProfiles';
  import { registerGlobalEffects, focusElementOnce } from '#utils/globalEffects';
  import { formatTimestamp, describeProfile } from '#utils/formatters';
  import {
    toggleSelection as toggleSelectionItem,
    selectAll as selectAllItems,
    clearSelection as clearSelectionItems,
    invertSelection as invertSelectionItems,
  } from '#utils/selection';
  import { computeHoverPreviewPosition } from '#utils/display';
  import { isValidDirectoryName } from '#utils/validation';
  import HoverPreview from '#views/shared/overlays/HoverPreview.svelte';
  import HelpModals from '#views/shared/modals/HelpModals.svelte';
  import {
    AppearanceTab,
    GdluxxTab,
    KeyboardTab,
    PreviewTab,
    ProfileManager,
    SettingsTabs,
  } from '#views/settings/tabs';
  import {
    FilterControls,
    ActionControls,
    ContentTabs,
    ContentHeader,
    LinkList,
    ImageList,
  } from '#views/main/components';
  import { AdvancedFiltering } from '#views/shared/filtering';
  import { applyThemeToShadowRoot } from '#src/content/overlayHost';
  import { createAppStore } from '#stores/app.svelte';
  import type { AppTab, SettingsTab, RemoteBackupMeta } from '#src/content/types';
  import { ensureSpriteMounted } from '#utils/spriteRegistry';
  import { SvelteSet } from 'svelte/reactivity';

  const { onclose, shadowContainer } = $props();

  // Tabs and filters
  let active: AppTab = $state('images');
  let filter = $state('');

  // Settings tabs
  let activeSettingsTab: SettingsTab = $state('preview');
  let startSel = $state('');
  let endSel = $state('');

  // Data
  let links = $state<string[]>([]);
  let images = $state<string[]>([]);
  let linkCounts = $state<Record<string, number>>({});
  let imageCounts = $state<Record<string, number>>({});
  let compact = $state(true);
  const selected = new SvelteSet<string>();

  const appStore = createAppStore();
  const settings = appStore.settings;
  const isConfigured = $derived(appStore.isConfigured);

  // Theme preferences
  let currentTheme = $state(appStore.theme);

  // Display preference
  let isFullscreen = $state(appStore.isFullscreen);

  // filtering profiles
  let profileScope = $state<ProfileScope>('host');
  let activeProfileId = $state<string | null>(null);
  let activeProfile = $state<SavedSelectorProfile | null>(null);
  let profileStatusMessage = $state<string | null>(null);
  let storageWarning = $state<string | null>(null);
  let hostProfiles = $state<SavedSelectorProfile[]>([]);
  let autoAppliedProfile = $state(false);
  const ignoredProfileIds = new SvelteSet<string>();
  let isSavingProfile = $state(false);
  let allProfiles = $state<SavedSelectorProfile[]>([]);
  let importProfilesText = $state('');
  let importProfilesError = $state<string | null>(null);
  let isImportingProfiles = $state(false);
  let isClearingProfiles = $state(false);
  let isExportingProfiles = $state(false);
  let profileNameDrafts = $state<Record<string, string>>({});
  let profileSearch = $state('');

  const EMPTY_REMOTE_PAYLOAD: ProfileBackupPayload = {
    hasBackup: false,
    profileCount: 0,
    syncedBy: null,
    updatedAt: null,
    bundle: { version: 1, profiles: {} },
  };

  let remoteBackupMeta = $state<RemoteBackupMeta | null>(null);
  let isLoadingRemoteBackup = $state(false);
  let isSavingRemoteBackup = $state(false);
  let isRestoringRemoteBackup = $state(false);
  let isDeletingRemoteBackup = $state(false);

  // Custom directory
  let customDirectoryEnabled = $state(false);
  let customDirectoryValue = $state('');

  // Range feedback
  let rangeHint = $state('');

  // Advanced section state
  let advancedExpanded = $state(false);
  const hasActiveFilters = $derived(!!(startSel.trim() || endSel.trim()));
  let showSelectorHelp = $state(false);
  let showScopeHelp = $state(false);

  // Hover preview state
  let hoverPreviewUrl = $state<string | null>(null);
  let hoverPreviewVisible = $state(false);
  let hoverPreviewPosition = $state({ x: 0, y: 0 });
  let hoverPreviewImageError = $state(false);

  // Input validation state
  let serverUrlError = $state(false);
  let apiKeyError = $state(false);
  let isTestingConnection = $state(false);
  let isSavingSettings = $state(false);

  // Derived filtered arrays
  const filteredLinks = $derived(
    !filter ? links : links.filter((u) => u.toLowerCase().includes(filter.toLowerCase())),
  );
  const filteredImages = $derived(
    !filter ? images : images.filter((u) => u.toLowerCase().includes(filter.toLowerCase())),
  );
  const visible = $derived(
    (active as AppTab) === 'links'
      ? filteredLinks
      : (active as AppTab) === 'images'
        ? filteredImages
        : [],
  );

  const hasActiveProfile = $derived(!!activeProfileId);
  const activeProfileDiffers = $derived(
    activeProfile
      ? activeProfile.startSelector !== startSel.trim() ||
          activeProfile.endSelector !== endSel.trim()
      : false,
  );
  const hasSelectors = $derived(!!(startSel.trim() || endSel.trim()));
  const filteredProfiles = $derived(
    !profileSearch.trim()
      ? allProfiles
      : allProfiles.filter((profile) => {
          const query = profileSearch.trim().toLowerCase();
          const parts = [
            profile.host,
            profile.origin ?? '',
            profile.path ?? '',
            profile.name ?? '',
            profile.startSelector,
            profile.endSelector,
            profile.scope,
          ]
            .join(' ')
            .toLowerCase();
          return parts.includes(query);
        }),
  );

  if (typeof window !== 'undefined') {
    setIgnoredProfileIds(readIgnoredProfileIds());
  }

  function populate() {
    const {
      links: l,
      images: i,
      linkCounts: lc,
      imageCounts: ic,
      meta,
    } = extractAll(startSel.trim(), endSel.trim());
    links = l;
    images = i;
    linkCounts = lc;
    imageCounts = ic;
    setSelected(new SvelteSet<string>());
    if (meta.rangeApplied) {
      if (!meta.startFound && !meta.endFound) {
        rangeHint = 'Range: selectors not found';
      } else if (!meta.startFound) {
        rangeHint = 'Range: start selector not found';
      } else if (!meta.endFound) {
        rangeHint = 'Range: end selector not found';
      } else if (meta.startBeforeEnd === false) {
        rangeHint = 'Range: start appears after end';
      } else {
        rangeHint = `Range: ${meta.inRangeAnchors} links, ${meta.inRangeImages} images scanned`;
      }
    } else {
      rangeHint = '';
    }
  }

  function setSelected(next: ReadonlySet<string>) {
    selected.clear();
    for (const value of next) {
      selected.add(value);
    }
  }

  function setIgnoredProfileIds(next: ReadonlySet<string>) {
    ignoredProfileIds.clear();
    for (const value of next) {
      ignoredProfileIds.add(value);
    }
  }

  function toggleSelect(url: string) {
    setSelected(toggleSelectionItem(selected, url));
  }

  function selectAll() {
    setSelected(selectAllItems(selected, visible));
  }

  function selectNone() {
    setSelected(clearSelectionItems());
  }

  function invertSelection() {
    setSelected(invertSelectionItems(selected, visible));
  }

  function copySelected() {
    const list = Array.from(selected);
    if (!list.length) {
      toastStore.warning('Please select URLs to copy.');
      return;
    }
    setClipboard(list.join('\n'))
      .then(() => {
        toastStore.success(
          `Copied ${list.length} URL${list.length === 1 ? '' : 's'} to clipboard!`,
        );
      })
      .catch((e) => {
        console.error('Clipboard error', e);
        toastStore.error('Failed to copy to clipboard.');
      });
  }

  function downloadSelected() {
    const list = Array.from(selected);
    if (!list.length) {
      toastStore.warning('Please select URLs to download.');
      return;
    }
    try {
      const blob = new Blob([list.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${active}_export.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastStore.success(`Downloaded ${list.length} URL${list.length === 1 ? '' : 's'} to file!`);
    } catch (error) {
      console.error('Download error', error);
      toastStore.error('Failed to download file.');
    }
  }

  async function sendSelected() {
    const list = Array.from(selected);
    if (!list.length) {
      toastStore.warning('No URLs to send. Please select URLs/images to send to gdluxx.');
      return;
    }
    if (!confirm(`Send ${list.length} URL(s) to gdluxx for processing?`)) return;

    // Get custom directory if enabled and valid
    const trimmed = customDirectoryValue.trim();
    const customDir =
      customDirectoryEnabled && trimmed && isValidDirectoryName(trimmed) ? trimmed : undefined;

    try {
      const res = await sendUrls(list, customDir);
      if (res.success) {
        toastStore.success(
          res.message ||
            `Successfully sent ${list.length} URL${list.length === 1 ? '' : 's'} to gdluxx!`,
        );
      } else {
        toastStore.error(`Failed to send: ${res.error}`);
      }
    } catch (error) {
      console.error('Send error', error);
      toastStore.error('Failed to send URLs to gdluxx.');
    }
  }

  async function initCustomDirectory() {
    try {
      const result = await browser.storage.local.get([
        'customDirectory_enabled',
        'customDirectory_value',
      ]);
      customDirectoryEnabled = result.customDirectory_enabled ?? false;
      customDirectoryValue = result.customDirectory_value ?? '';
    } catch (error) {
      console.error('Failed to load custom directory settings', error);
    }
  }

  function handleCustomDirectoryToggle() {
    customDirectoryEnabled = !customDirectoryEnabled;
    browser.storage.local.set({ customDirectory_enabled: customDirectoryEnabled });
  }

  function handleCustomDirectoryChange(value: string) {
    customDirectoryValue = value;
    browser.storage.local.set({ customDirectory_value: value });
  }

  function handleCustomDirectoryClear() {
    customDirectoryEnabled = false;
    customDirectoryValue = '';
    browser.storage.local.set({
      customDirectory_enabled: false,
      customDirectory_value: '',
    });
  }

  async function init() {
    try {
      await appStore.hydrate();
      await initCustomDirectory();
      currentTheme = appStore.theme;
      isFullscreen = appStore.isFullscreen;
      if (shadowContainer) {
        const shadowRoot = shadowContainer.getRootNode() as ShadowRoot;
        ensureSpriteMounted(shadowRoot);
        applyThemeToShadowRoot(shadowRoot, currentTheme);
      }
      await initializeSelectorProfiles();
      await refreshRemoteBackupMeta(false);
    } finally {
      populate();
    }
  }
  init();

  async function initializeSelectorProfiles() {
    if (typeof window === 'undefined') return;
    try {
      const pref = await getPreferredScope();
      if (pref) profileScope = pref;
    } catch {
      /* ignore */
    }

    try {
      const status = await getSelectorStorageStatus();
      storageWarning = status.degraded ? (status.error ?? 'Selector storage degraded') : null;
    } catch {
      storageWarning = 'Selector storage unavailable';
    }

    await refreshHostProfiles();
    await loadAllProfiles();

    const ignored = ignoredProfileIds;
    try {
      const match = await getProfileForUrl(window.location.href);
      if (match && !ignored.has(match.id)) {
        activeProfileId = match.id;
        activeProfile = match.profile;
        startSel = match.profile.startSelector;
        endSel = match.profile.endSelector;
        profileStatusMessage = buildProfileMessage(match.profile);
        autoAppliedProfile = true;
      }
    } catch {
      /* ignore */
    }
  }

  function buildProfileMessage(profile: SavedSelectorProfile): string {
    if (profile.scope === 'path' && profile.path) {
      return `Using saved range for ${profile.host}${profile.path}`;
    }
    if (profile.scope === 'origin' && profile.origin) {
      return `Using saved range for ${profile.origin}`;
    }
    return `Using saved range for ${profile.host}`;
  }

  async function refreshHostProfiles() {
    if (typeof window === 'undefined') return;
    try {
      const list = await getProfilesForHost(window.location.hostname);
      hostProfiles = list;
    } catch {
      hostProfiles = [];
    }
  }

  async function loadAllProfiles() {
    try {
      const list = await loadSelectorProfiles();
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
      console.error('Failed to load saved selector profiles', error);
      allProfiles = [];
      profileNameDrafts = {};
    }
  }

  function getCurrentScopeInput(scope: ProfileScope) {
    if (typeof window === 'undefined') {
      return {
        scope,
        host: '',
        origin: '',
        path: '/',
        startSelector: startSel,
        endSelector: endSel,
      };
    }
    const { hostname, origin, pathname } = window.location;
    return {
      scope,
      host: hostname,
      origin,
      path: pathname,
      startSelector: startSel,
      endSelector: endSel,
    };
  }

  async function onSaveProfile(scopeOverride?: ProfileScope) {
    if (!hasSelectors) {
      toastStore.warning('Enter a start or end selector before saving.');
      return;
    }
    if (isSavingProfile) return;
    isSavingProfile = true;
    const scope = scopeOverride ?? profileScope;
    try {
      const payload = getCurrentScopeInput(scope);
      const { profile, id } = await saveSelectorProfile(payload);
      activeProfileId = id;
      activeProfile = profile;
      profileScope = scope;
      profileStatusMessage = buildProfileMessage(profile);
      autoAppliedProfile = false;
      const nextIgnored = new SvelteSet(ignoredProfileIds);
      if (nextIgnored.has(id)) {
        nextIgnored.delete(id);
        setIgnoredProfileIds(nextIgnored);
        persistIgnoredProfileIds(nextIgnored);
      }
      await setPreferredScope(scope);
      await refreshHostProfiles();
      await loadAllProfiles();
      populate();
      toastStore.success('Saved range selectors for this site.');
    } catch (error) {
      console.error('Failed to save selector profile', error);
      toastStore.error('Failed to save selectors.');
    } finally {
      isSavingProfile = false;
    }
  }

  async function onDeleteProfile() {
    if (!activeProfileId) return;
    if (!confirm('Remove the saved selectors for this site?')) return;
    try {
      await deleteSelectorProfile(activeProfileId);
      const nextIgnored = new SvelteSet(ignoredProfileIds);
      nextIgnored.delete(activeProfileId);
      setIgnoredProfileIds(nextIgnored);
      persistIgnoredProfileIds(nextIgnored);
      startSel = '';
      endSel = '';
      activeProfileId = null;
      activeProfile = null;
      profileStatusMessage = null;
      autoAppliedProfile = false;
      toastStore.success('Saved selectors removed.');
      await refreshHostProfiles();
      await loadAllProfiles();
      populate();
    } catch (error) {
      console.error('Failed to delete selector profile', error);
      toastStore.error('Failed to delete saved selectors.');
    }
  }

  function onIgnoreProfile() {
    if (!activeProfileId) return;
    const next = new SvelteSet(ignoredProfileIds);
    next.add(activeProfileId);
    setIgnoredProfileIds(next);
    persistIgnoredProfileIds(next);
    profileStatusMessage = 'Saved selectors ignored for this session.';
    activeProfileId = null;
    activeProfile = null;
    autoAppliedProfile = false;
    toastStore.info('Saved selectors will be ignored until you reload the page.');
  }

  async function onApplyProfile(id: string) {
    const profile = hostProfiles.find((p) => p.id === id);
    if (!profile) return;
    startSel = profile.startSelector;
    endSel = profile.endSelector;
    activeProfileId = profile.id;
    activeProfile = profile;
    profileScope = profile.scope;
    profileStatusMessage = buildProfileMessage(profile);
    autoAppliedProfile = false;
    const next = new SvelteSet(ignoredProfileIds);
    if (next.has(profile.id)) {
      next.delete(profile.id);
      setIgnoredProfileIds(next);
      persistIgnoredProfileIds(next);
    }
    toastStore.success('Applied saved selectors.');
    populate();
    await refreshHostProfiles();
    await loadAllProfiles();
  }

  async function onScopeChange(scope: ProfileScope) {
    profileScope = scope;
    try {
      await setPreferredScope(scope);
    } catch {
      /* ignore */
    }
  }

  function setRemoteMeta(payload: ProfileBackupPayload | null) {
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

  function ensureConfiguredForRemote(showToast = true): boolean {
    const hasUrl = !!settings.serverUrl;
    const hasKey = !!settings.apiKey;
    if (!hasUrl || !hasKey) {
      if (showToast) {
        toastStore.error('Configure your gdluxx server URL and API key first.');
      }
      return false;
    }
    const { valid, error } = validateServerUrl(settings.serverUrl);
    if (!valid) {
      if (showToast) {
        toastStore.error(error ?? 'Invalid server URL');
      }
      return false;
    }
    return true;
  }

  async function refreshRemoteBackupMeta(showToast = false) {
    if (!ensureConfiguredForRemote(showToast)) {
      remoteBackupMeta = null;
      return;
    }
    if (isLoadingRemoteBackup) return;
    isLoadingRemoteBackup = true;
    try {
      const res = await fetchProfileBackup(settings.serverUrl, settings.apiKey);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (showToast && res.message) {
          toastStore.info(res.message);
        }
      } else {
        setRemoteMeta(null);
        if (showToast) {
          toastStore.error(res.error ?? 'Failed to load remote backup');
        }
      }
    } catch (error) {
      console.error('Failed to fetch remote backup metadata', error);
      setRemoteMeta(null);
      if (showToast) {
        toastStore.error('Failed to reach gdluxx for backup status.');
      }
    } finally {
      isLoadingRemoteBackup = false;
    }
  }

  async function onBackupProfiles() {
    if (isSavingRemoteBackup) return;
    if (!ensureConfiguredForRemote()) return;
    isSavingRemoteBackup = true;
    try {
      const bundle = await exportSelectorProfiles();
      const res = await saveProfileBackup(settings.serverUrl, settings.apiKey, bundle);
      if (res.success && res.data) {
        setRemoteMeta(res.data);
        if (res.message) {
          toastStore.success(res.message);
        } else {
          toastStore.success('Backed up selector profiles to gdluxx.');
        }
      } else {
        toastStore.error(res.error ?? 'Failed to backup profiles to gdluxx.');
      }
    } catch (error) {
      console.error('Failed to backup selector profiles to gdluxx', error);
      toastStore.error('Failed to backup profiles to gdluxx.');
    } finally {
      isSavingRemoteBackup = false;
    }
  }

  async function onRestoreProfiles() {
    if (isRestoringRemoteBackup) return;
    if (!ensureConfiguredForRemote()) return;
    isRestoringRemoteBackup = true;
    try {
      const res = await fetchProfileBackup(settings.serverUrl, settings.apiKey);
      if (!res.success || !res.data) {
        toastStore.error(res.error ?? 'Failed to load remote backup.');
        return;
      }
      setRemoteMeta(res.data);
      if (!res.data.hasBackup) {
        toastStore.info('No remote backup found for this API key.');
        return;
      }
      await importSelectorProfiles(res.data.bundle);
      toastStore.success(res.message ?? 'Restored selector profiles from gdluxx.');
      await refreshHostProfiles();
      await loadAllProfiles();
    } catch (error) {
      console.error('Failed to restore selector profiles from gdluxx', error);
      toastStore.error('Failed to restore profiles from gdluxx.');
    } finally {
      isRestoringRemoteBackup = false;
    }
  }

  async function onDeleteRemoteBackup() {
    if (isDeletingRemoteBackup) return;
    if (!ensureConfiguredForRemote()) return;
    if (!confirm('Remove the remote range profile backup from gdluxx?')) return;
    isDeletingRemoteBackup = true;
    try {
      const res = await deleteProfileBackup(settings.serverUrl, settings.apiKey);
      if (res.success && res.data) {
        if (res.data.deleted) {
          setRemoteMeta(EMPTY_REMOTE_PAYLOAD);
        }
        if (res.message) {
          toastStore.success(res.message);
        } else if (res.data.deleted) {
          toastStore.success('Removed remote backup.');
        } else {
          toastStore.info('No remote backup to delete.');
        }
      } else {
        toastStore.error(res.error ?? 'Failed to delete remote backup.');
      }
    } catch (error) {
      console.error('Failed to delete remote selector profile backup', error);
      toastStore.error('Failed to delete remote backup.');
    } finally {
      isDeletingRemoteBackup = false;
    }
  }

  async function onExportProfiles() {
    if (isExportingProfiles) return;
    isExportingProfiles = true;
    try {
      const bundle = await exportSelectorProfiles();
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
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
      isExportingProfiles = false;
    }
  }

  async function onImportProfiles() {
    if (!importProfilesText.trim()) {
      importProfilesError = 'Paste exported JSON before importing.';
      return;
    }
    if (isImportingProfiles) return;
    isImportingProfiles = true;
    importProfilesError = null;
    try {
      const payload = JSON.parse(importProfilesText);
      await importSelectorProfiles(payload);
      toastStore.success('Imported selector profiles.');
      importProfilesText = '';
      await refreshHostProfiles();
      await loadAllProfiles();
    } catch (error) {
      console.error('Failed to import selector profiles', error);
      importProfilesError =
        error instanceof Error ? error.message : 'Unknown error while importing profiles';
      toastStore.error('Failed to import profiles.');
    } finally {
      isImportingProfiles = false;
    }
  }

  async function onClearProfiles() {
    if (isClearingProfiles) return;
    if (!confirm('Clear all saved selector profiles?')) return;
    isClearingProfiles = true;
    try {
      await clearSelectorProfiles();
      activeProfileId = null;
      activeProfile = null;
      profileStatusMessage = null;
      autoAppliedProfile = false;
      const cleared = new SvelteSet<string>();
      setIgnoredProfileIds(cleared);
      persistIgnoredProfileIds(cleared);
      toastStore.success('Cleared all saved selector profiles.');
      await refreshHostProfiles();
      await loadAllProfiles();
    } catch (error) {
      console.error('Failed to clear selector profiles', error);
      toastStore.error('Failed to clear profiles.');
    } finally {
      isClearingProfiles = false;
    }
  }

  async function onRenameProfile(id: string, name: string) {
    const trimmed = name.trim();
    const existing = allProfiles.find((p) => p.id === id);
    if (existing && (existing.name ?? '') === trimmed) return;
    try {
      await renameSelectorProfile(id, trimmed);
      await refreshHostProfiles();
      await loadAllProfiles();
    } catch (error) {
      console.error('Failed to rename selector profile', error);
      toastStore.error('Failed to rename profile.');
    }
  }

  async function onDeleteProfileById(id: string) {
    if (!confirm('Delete this saved selector profile?')) return;
    try {
      await deleteSelectorProfile(id);
      if (activeProfileId === id) {
        startSel = '';
        endSel = '';
        activeProfileId = null;
        activeProfile = null;
        profileStatusMessage = null;
        autoAppliedProfile = false;
      }
      const next = new SvelteSet(ignoredProfileIds);
      if (next.delete(id)) {
        setIgnoredProfileIds(next);
        persistIgnoredProfileIds(next);
      }
      toastStore.success('Deleted saved selector profile.');
      await refreshHostProfiles();
      await loadAllProfiles();
      populate();
    } catch (error) {
      console.error('Failed to delete selector profile', error);
      toastStore.error('Failed to delete profile.');
    }
  }

  async function onTest() {
    if (isTestingConnection) return;

    // Clear previous errors
    serverUrlError = false;
    apiKeyError = false;
    isTestingConnection = true;

    const missingUrl = !settings.serverUrl;
    const missingKey = !settings.apiKey;

    if (missingUrl || missingKey) {
      serverUrlError = missingUrl;
      apiKeyError = missingKey;
      toastStore.error('Please enter both Server URL and API Key');
      isTestingConnection = false;
      return;
    }

    try {
      const res = await testConnection(settings.serverUrl, settings.apiKey);
      if (res.success) {
        toastStore.success(res.message || 'Connection test successful!');
      } else {
        toastStore.error(res.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      toastStore.error('Failed to test connection');
    } finally {
      isTestingConnection = false;
    }
  }

  async function onSave() {
    if (isSavingSettings) return;

    // Clear previous errors
    serverUrlError = false;
    apiKeyError = false;
    isSavingSettings = true;

    const missingUrl = !settings.serverUrl;
    const missingKey = !settings.apiKey;

    if (missingUrl || missingKey) {
      serverUrlError = missingUrl;
      apiKeyError = missingKey;
      toastStore.error('Please enter both Server URL and API Key');
      isSavingSettings = false;
      return;
    }

    // Validate URL
    const v = validateServerUrl(settings.serverUrl);
    if (!v.valid) {
      serverUrlError = true;
      toastStore.error(v.error ?? 'Invalid Server URL');
      isSavingSettings = false;
      return;
    }

    try {
      await saveSettings(settings);
      toastStore.success('Settings saved successfully!');
    } catch (error) {
      console.error('Save settings error:', error);
      toastStore.error('Failed to save settings');
    } finally {
      isSavingSettings = false;
    }
  }

  async function onThemeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const value = target.value;
    currentTheme = value;

    // Apply theme to shadow root
    if (shadowContainer) {
      const shadowRoot = shadowContainer.getRootNode() as ShadowRoot;
      applyThemeToShadowRoot(shadowRoot, value);
    }

    try {
      await appStore.applyTheme(value);
    } catch (error) {
      console.error('Failed to persist theme preference', error);
    }
  }

  async function onToggleDisplayMode() {
    isFullscreen = !isFullscreen;
    try {
      await appStore.applyDisplayMode(isFullscreen ? 'fullscreen' : 'modal');
    } catch (error) {
      console.error('Failed to persist display mode preference', error);
    }
  }

  function onServerUrlInput() {
    serverUrlError = false;
  }

  function onApiKeyInput() {
    apiKeyError = false;
  }

  async function onReset() {
    if (!confirm('Are you sure you want to reset all gdluxx settings?')) return;

    try {
      settings.serverUrl = '';
      settings.apiKey = '';
      await saveSettings({ serverUrl: '', apiKey: '' });
      toastStore.success('Settings reset successfully!');
    } catch (error) {
      console.error('Reset settings error:', error);
      toastStore.error('Failed to reset settings');
    }
  }

  async function onToggleImagePreviews(event: Event) {
    const input = event.target as HTMLInputElement;
    const previous = settings.showImagePreviews;
    const next = input.checked;
    settings.showImagePreviews = next;
    try {
      await saveSettings({ showImagePreviews: next });
    } catch (error) {
      console.error('Failed to update image preview preference', error);
      settings.showImagePreviews = previous;
      input.checked = previous;
      toastStore.error('Could not update image preview preference.');
    }
  }

  async function onToggleImageHoverPreview(event: Event) {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;
    const previous = settings.showImageHoverPreview;
    const next = select.value as 'off' | 'small' | 'medium' | 'large';
    settings.showImageHoverPreview = next;
    try {
      await saveSettings({ showImageHoverPreview: next });
    } catch (error) {
      console.error('Failed to update hover preview preference', error);
      settings.showImageHoverPreview = previous;
      select.value = previous;
      toastStore.error('Could not update hover preview preference.');
    }
  }

  function setImportProfilesText(value: string) {
    importProfilesText = value;
    importProfilesError = null;
  }

  function setProfileSearch(value: string) {
    profileSearch = value;
  }

  function updateProfileNameDraft(id: string, value: string) {
    const next = { ...profileNameDrafts };
    next[id] = value;
    profileNameDrafts = next;
  }

  function updateHoverPreviewPositionFromPoint(x: number, y: number) {
    if (settings.showImageHoverPreview === 'off') return;
    hoverPreviewPosition = computeHoverPreviewPosition(settings.showImageHoverPreview, x, y);
  }

  function showHoverPreview(url: string, event: MouseEvent | FocusEvent) {
    if (settings.showImageHoverPreview === 'off') return;
    hoverPreviewUrl = url;
    hoverPreviewVisible = true;
    hoverPreviewImageError = false;

    if (event instanceof MouseEvent) {
      updateHoverPreviewPositionFromPoint(event.clientX, event.clientY);
    } else {
      const target = event.target as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        updateHoverPreviewPositionFromPoint(rect.right, rect.top);
      }
    }
  }

  function updateHoverPreviewPositionFromEvent(event: MouseEvent) {
    if (!hoverPreviewVisible || settings.showImageHoverPreview === 'off') return;
    updateHoverPreviewPositionFromPoint(event.clientX, event.clientY);
  }

  function hideHoverPreview() {
    hoverPreviewVisible = false;
    hoverPreviewUrl = null;
  }
  // Accesibility focus on filter, Esc to close
  let filterEl = $state<HTMLInputElement | null>(null);
  let didFocus = false;
  $effect(() => {
    if (!didFocus && active !== 'settings') {
      didFocus = true;
      focusElementOnce(() => filterEl);
    }
  });
  $effect(() =>
    registerGlobalEffects({
      onClose: onclose,
      canSaveProfile: () =>
        !(isSavingProfile || !hasSelectors || (hasActiveProfile && !activeProfileDiffers)),
      saveProfile: () => onSaveProfile(),
    }),
  );

  $effect(() => {
    const nextTheme = appStore.theme;
    if (currentTheme !== nextTheme) {
      currentTheme = nextTheme;
    }
  });

  $effect(() => {
    const fullscreen = appStore.isFullscreen;
    if (isFullscreen !== fullscreen) {
      isFullscreen = fullscreen;
    }
  });

  $effect(() => {
    if (!shadowContainer) return;
    const root = shadowContainer.getRootNode();
    if (root instanceof ShadowRoot) {
      applyThemeToShadowRoot(root, currentTheme);
    }
  });

  $effect(() => {
    if (settings.showImageHoverPreview === 'off' && hoverPreviewVisible) {
      hoverPreviewVisible = false;
      hoverPreviewUrl = null;
      hoverPreviewImageError = false;
    }
  });
</script>

<!-- Modal backdrop -->
<div
  class="fixed inset-0 z-[2147483646] bg-black/50"
  role="button"
  tabindex="0"
  onclick={() => onclose()}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onclose();
    }
  }}
></div>

<!-- Modal content -->
<div
  class="border-base-300 bg-base-200 text-base-content fixed z-[2147483647] box-border flex flex-col border text-left font-sans text-base {isFullscreen
    ? 'inset-0 h-full w-full rounded-none shadow-none'
    : 'inset-5 mx-auto max-w-[1200px] rounded-md shadow-xl'}"
  style="font-size: 16px !important; line-height: 1.5 !important; text-align: left !important; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif !important;"
>
  <div class="{isFullscreen ? '' : 'rounded-t-md'} bg-base-100">
    <!-- Header Section -->
    <div class="border-base-300 border-b px-6 py-4">
      <div class="flex items-center justify-between">
        <ContentHeader
          {active}
          linkCount={filteredLinks.length}
          imageCount={filteredImages.length}
        />
        <ul class="menu menu-horizontal bg-base-200 rounded-box">
          <li>
            <button
              title={active === 'settings' ? 'Home' : 'Settings'}
              aria-label={active === 'settings' ? 'Home' : 'Settings'}
              onclick={() => {
                active = active === 'settings' ? 'images' : 'settings';
              }}
            >
              <Icon
                iconName={active === 'settings' ? 'home' : 'settings'}
                class="text-base-content h-5 w-5"
              />
            </button>
          </li>
          <li>
            <button
              title="Close"
              aria-label="Close"
              onclick={() => onclose()}
            >
              <Icon
                iconName="close"
                class="text-base-content h-5 w-5"
              />
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Controls Section -->
    {#if active !== 'settings'}
      <div class="border-base-300 bg-base-200 space-y-4 border-b px-6 py-4">
        <!-- Filter Input -->
        <FilterControls
          bind:value={filter}
          bind:inputEl={filterEl}
        />

        <!-- Range Selectors -->
        <AdvancedFiltering
          bind:expanded={advancedExpanded}
          {hasActiveFilters}
          bind:startSelector={startSel}
          bind:endSelector={endSel}
          bind:profileScope
          {hasSelectors}
          {hasActiveProfile}
          {activeProfileDiffers}
          {profileStatusMessage}
          {autoAppliedProfile}
          {isSavingProfile}
          {hostProfiles}
          {rangeHint}
          {storageWarning}
          onapply={populate}
          onreset={() => {
            startSel = '';
            endSel = '';
            populate();
          }}
          onsaveprofile={() => onSaveProfile()}
          ondeleteprofile={onDeleteProfile}
          onignoreprofile={onIgnoreProfile}
          onscopechange={(scope) => onScopeChange(scope)}
          onapplyprofile={(profileId) => onApplyProfile(profileId)}
          onshowselectorhelp={() => (showSelectorHelp = true)}
          onshowscopehelp={() => (showScopeHelp = true)}
        />
      </div>

      <ActionControls
        {isConfigured}
        selectionCount={selected.size}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
        onInvertSelection={invertSelection}
        onCopySelected={copySelected}
        onDownloadSelected={downloadSelected}
        onSendSelected={sendSelected}
        {customDirectoryEnabled}
        {customDirectoryValue}
        onCustomDirectoryToggle={handleCustomDirectoryToggle}
        onCustomDirectoryChange={handleCustomDirectoryChange}
        onCustomDirectoryClear={handleCustomDirectoryClear}
      />
    {/if}

    <!-- Tabs -->
    {#if active !== 'settings'}
      <ContentTabs
        {active}
        imageCount={filteredImages.length}
        linkCount={filteredLinks.length}
        onchange={(tab) => (active = tab)}
      />
    {/if}
  </div>

  <div class="border-base-300 bg-base-100 min-h-0 flex-1 overflow-auto border-b px-6">
    {#if active === 'links'}
      <LinkList
        links={filteredLinks}
        counts={linkCounts}
        {selected}
        {compact}
        onToggle={toggleSelect}
      />
    {:else if active === 'images'}
      <ImageList
        images={filteredImages}
        counts={imageCounts}
        {selected}
        {compact}
        {showHoverPreview}
        updateHoverPosition={updateHoverPreviewPositionFromEvent}
        {hideHoverPreview}
        onToggle={toggleSelect}
        showImagePreviews={settings.showImagePreviews}
      />
    {:else}
      <div class="max-w-full py-4">
        <SettingsTabs
          activeTab={activeSettingsTab}
          onchange={(tab) => (activeSettingsTab = tab)}
        />

        {#if activeSettingsTab === 'gdluxx'}
          <GdluxxTab
            {settings}
            {serverUrlError}
            {apiKeyError}
            {isSavingSettings}
            {isTestingConnection}
            {onServerUrlInput}
            {onApiKeyInput}
            {onTest}
            {onSave}
            {onReset}
          />

          <ProfileManager
            {isConfigured}
            {isSavingSettings}
            {isTestingConnection}
            {isSavingRemoteBackup}
            {isRestoringRemoteBackup}
            {isLoadingRemoteBackup}
            {isDeletingRemoteBackup}
            {isExportingProfiles}
            {isImportingProfiles}
            {isClearingProfiles}
            {allProfiles}
            {filteredProfiles}
            {profileNameDrafts}
            {profileSearch}
            {importProfilesText}
            {importProfilesError}
            {remoteBackupMeta}
            {formatTimestamp}
            {describeProfile}
            onRefreshProfiles={loadAllProfiles}
            {onExportProfiles}
            {onImportProfiles}
            {onClearProfiles}
            {onBackupProfiles}
            {onRestoreProfiles}
            onRefreshRemoteStatus={() => refreshRemoteBackupMeta(true)}
            {onDeleteRemoteBackup}
            {onApplyProfile}
            onDeleteProfile={onDeleteProfileById}
            {onRenameProfile}
            onImportTextChange={setImportProfilesText}
            onProfileSearchChange={setProfileSearch}
            onProfileDraftChange={updateProfileNameDraft}
          />
        {/if}
        {#if activeSettingsTab === 'appearance'}
          <AppearanceTab
            {currentTheme}
            {isFullscreen}
            showImagePreviews={settings.showImagePreviews}
            showImageHoverPreview={settings.showImageHoverPreview}
            {onThemeChange}
            {onToggleDisplayMode}
            {onToggleImagePreviews}
            {onToggleImageHoverPreview}
          />
        {/if}
        {#if activeSettingsTab === 'preview'}
          <PreviewTab
            {isFullscreen}
            showImagePreviews={settings.showImagePreviews}
            showImageHoverPreview={settings.showImageHoverPreview}
            {onToggleDisplayMode}
            {onToggleImagePreviews}
            {onToggleImageHoverPreview}
          />
        {/if}
        {#if activeSettingsTab === 'keyboard'}
          <KeyboardTab {settings} />
        {/if}
      </div>
    {/if}
  </div>

  <div class="flex h-12 items-center justify-between gap-3 px-6">
    {#if active !== 'settings'}
      <div class="text-base-content/50 flex gap-3">
        <span>
          Visible: {visible.length} / {active === 'links'
            ? links.length
            : active === 'images'
              ? images.length
              : 0}
        </span>
        <span>Selected: {Array.from(selected).length}</span>
      </div>
      <label class="text-base-content/50 text-sm">
        <input
          type="checkbox"
          class="toggle toggle-accent toggle-xs"
          bind:checked={compact}
        /> Compact rows
      </label>
    {/if}
  </div>

  <HoverPreview
    visible={settings.showImageHoverPreview !== 'off' && hoverPreviewVisible}
    url={hoverPreviewUrl}
    position={hoverPreviewPosition}
    mode={settings.showImageHoverPreview}
    hasError={hoverPreviewImageError}
    onerror={() => (hoverPreviewImageError = true)}
  />
</div>

<ToastContainer />

<HelpModals
  {showSelectorHelp}
  {showScopeHelp}
  oncloseselector={() => (showSelectorHelp = false)}
  onclosescope={() => (showScopeHelp = false)}
/>
