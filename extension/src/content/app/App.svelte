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
  import { onMount } from 'svelte';
  import { extractAll } from '#utils/extract';
  import { setClipboard } from '#utils/clipboard';
  import {
    saveSettings,
    validateServerUrl,
    readIgnoredProfileIds,
    persistIgnoredProfileIds,
    readIgnoredSubProfileIds,
    persistIgnoredSubProfileIds,
  } from '#utils/persistence';
  import {
    sendUrls,
    testConnection,
    fetchProfileBackup,
    saveProfileBackup,
    deleteProfileBackup,
    type ProfileBackupPayload,
    fetchSubBackup,
    saveSubBackup,
    deleteSubBackup,
    type SubBackupPayload,
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
  import { formatTimestamp, describeProfile, describeSubProfile } from '#utils/formatters';
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
  import { SubSection } from '#views/shared/substitution';
  import { applyThemeToShadowRoot } from '#src/content/overlayHost';
  import { createAppStore } from '#stores/app.svelte';
  import type { AppTab, SettingsTab, RemoteBackupMeta } from '#src/content/types';
  import { ensureSpriteMounted } from '#utils/spriteRegistry';
  import { applySubRules, createSubRule, type SubResult, type SubRule } from '#utils/substitution';
  import * as subStorage from '#utils/storageSubstitution';
  import type { SavedSubProfile, SaveSubProfileInput } from '#utils/storageSubstitution';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

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

  let subRemoteBackupMeta = $state<RemoteBackupMeta | null>(null);
  let isLoadingSubRemoteBackup = $state(false);
  let isSavingSubRemoteBackup = $state(false);
  let isRestoringSubRemoteBackup = $state(false);
  let isDeletingSubRemoteBackup = $state(false);

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
  let showSubRegexHelp = $state(false);

  // Substitution profiles and rules
  let subRules = $state<SubRule[]>([]);
  let subExpanded = $state(false);
  let subProfileScope = $state<ProfileScope>('host');
  let activeSubProfileId = $state<string | null>(null);
  let activeSubProfile = $state<SavedSubProfile | null>(null);
  let subProfileStatusMessage = $state<string | null>(null);
  let autoAppliedSubProfile = $state(false);
  let applySubToPreview = $state(false);
  let applyDefaultSub = $state(true);
  let isSavingSubProfile = $state(false);
  let hostSubProfiles = $state<SavedSubProfile[]>([]);
  let allSubProfiles = $state<SavedSubProfile[]>([]);
  let subProfileNameDrafts = $state<Record<string, string>>({});
  let subProfileSearch = $state('');
  let importSubProfilesText = $state('');
  let importSubProfilesError = $state<string | null>(null);
  let isImportingSubs = $state(false);
  let isClearingSubs = $state(false);
  let isExportingSubs = $state(false);
  let subStorageWarning = $state<string | null>(null);
  const ignoredSubProfileIds = new SvelteSet<string>();
  const urlModifications = new SvelteMap<string, SubResult>();
  const modifiedUrls = new SvelteSet<string>();
  const hasActiveSubs = $derived(
    subRules.some((rule) => rule.enabled && rule.pattern.trim().length > 0),
  );
  const hasSubRules = $derived(subRules.length > 0);

  function cloneSubRulesForEditing(source: SubRule[]): SubRule[] {
    return source.map((rule, index) => ({
      ...rule,
      order: index,
    }));
  }

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

  const activeSubProfileDiffers = $derived(
    activeSubProfile
      ? rulesDifferFromProfile(activeSubProfile.rules, subRules) ||
          activeSubProfile.applyToPreview !== applySubToPreview
      : false,
  );

  let subPreviewCount = $state(0);

  $effect(() => {
    if (!hasActiveSubs) {
      subPreviewCount = 0;
      return;
    }
    const targets = Array.from(selected);
    if (!targets.length) {
      subPreviewCount = 0;
      return;
    }
    let count = 0;
    for (const url of targets) {
      if (applySubRules(url, subRules).modified) {
        count += 1;
      }
    }
    subPreviewCount = count;
  });

  const filteredSubProfiles = $derived(
    !subProfileSearch.trim()
      ? allSubProfiles
      : allSubProfiles.filter((profile) => {
          const query = subProfileSearch.trim().toLowerCase();
          const parts = [
            profile.host,
            profile.origin ?? '',
            profile.path ?? '',
            profile.name ?? '',
            profile.scope,
            `${profile.rules.length}`,
          ]
            .join(' ')
            .toLowerCase();
          return parts.includes(query);
        }),
  );

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

  let subRulesLoaded = false;

  onMount(async () => {
    try {
      const storedRules = await subStorage.loadActiveSubRules();
      if (storedRules.length) {
        subRules = cloneSubRulesForEditing(storedRules.sort((a, b) => a.order - b.order));
      } else {
        subRules = [createSubRule('', '', 'g', 0)];
      }
    } catch (error) {
      console.error('Failed to load replacement rules', error);
      subRules = [createSubRule('', '', 'g', 0)];
    } finally {
      subRulesLoaded = true;
    }
  });

  $effect(() => {
    if (!subRulesLoaded) return;
    subStorage.persistActiveSubRules(subRules).catch((error) => {
      console.error('Failed to persist replacement rules', error);
    });
  });

  if (typeof window !== 'undefined') {
    setIgnoredProfileIds(readIgnoredProfileIds());
    setIgnoredSubProfileIds(readIgnoredSubProfileIds());
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
    urlModifications.clear();
    modifiedUrls.clear();
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

  function setIgnoredSubProfileIds(next: ReadonlySet<string>) {
    ignoredSubProfileIds.clear();
    for (const value of next) {
      ignoredSubProfileIds.add(value);
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

  function updateModificationTracking(url: string, result: SubResult | null) {
    if (result === null) {
      urlModifications.delete(url);
      modifiedUrls.delete(url);
      return;
    }

    urlModifications.set(url, result);
    modifiedUrls.add(url);
  }

  function applySubs() {
    if (!hasActiveSubs) {
      toastStore.info('Add an active substitution rule before applying.');
      return;
    }

    const itemsToModify = Array.from(selected);
    if (!itemsToModify.length) {
      toastStore.warning('No items selected. Please select URLs/images to apply substitutions.');
      return;
    }

    const nextSelected = new SvelteSet(selected);
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

    for (const url of itemsToModify) {
      const result = applySubRules(url, subRules);
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

    setSelected(nextSelected);

    if (!pendingModifications.size && !pendingModifiedUrls.size) {
      toastStore.info('No URLs were modified by the substitution rules');
      return;
    }

    for (const [key, value] of pendingModifications) {
      updateModificationTracking(key, value);
    }

    const modifiedCount = pendingModifiedUrls.size;
    toastStore.success(
      `Applied substitutions to ${modifiedCount} URL${modifiedCount === 1 ? '' : 's'}`,
    );
  }

  function resetSubs() {
    if (modifiedUrls.size === 0) {
      toastStore.info('No modifications to reset');
      return;
    }

    if (
      !confirm(
        `Reset all URL modifications (${modifiedUrls.size} URL${modifiedUrls.size === 1 ? '' : 's'})? This cannot be undone.`,
      )
    ) {
      return;
    }

    const nextSelected = new SvelteSet(selected);
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

      nextSelected.delete(currentUrl);
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

    setSelected(nextSelected);

    urlModifications.clear();
    modifiedUrls.clear();

    toastStore.info('All modifications reset');
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
      await initializeSubProfiles();
      await refreshRemoteBackupMeta(false);
      await refreshSubRemoteBackupMeta(false);
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

  async function initializeSubProfiles() {
    if (typeof window === 'undefined') return;
    try {
      const pref = await subStorage.getPreferredSubScope();
      if (pref) subProfileScope = pref;
    } catch {
      // ignore
    }

    try {
      const status = await subStorage.getSubStorageStatus();
      subStorageWarning = status.degraded
        ? (status.error ?? 'Substitution profile storage degraded')
        : null;
    } catch {
      subStorageWarning = 'Substitution profile storage unavailable';
    }

    try {
      const shouldAutoApply = await subStorage.getAutoApplySubDefault();
      applyDefaultSub = shouldAutoApply;
    } catch {
      applyDefaultSub = true;
    }

    await refreshHostReplacementProfiles();
    await loadAllSubProfiles();

    if (!applyDefaultSub) return;

    const ignored = ignoredSubProfileIds;
    try {
      const match = await subStorage.getSubProfileForUrl(window.location.href);
      if (match && !ignored.has(match.id)) {
        activeSubProfileId = match.id;
        activeSubProfile = match.profile;
        subRules = cloneSubRulesForEditing(
          match.profile.rules.slice().sort((a, b) => a.order - b.order),
        );
        applySubToPreview = match.profile.applyToPreview;
        subProfileStatusMessage = buildReplacementProfileMessage(match.profile);
        autoAppliedSubProfile = true;
      }
    } catch (error) {
      console.error('Failed to auto-apply substitution profile', error);
    }
  }

  function buildReplacementProfileMessage(profile: SavedSubProfile): string {
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

  async function refreshHostReplacementProfiles() {
    if (typeof window === 'undefined') return;
    try {
      const list = await subStorage.getSubProfilesForHost(window.location.hostname);
      hostSubProfiles = list;
    } catch {
      hostSubProfiles = [];
    }
  }

  async function loadAllSubProfiles() {
    try {
      const list = await subStorage.loadSubProfiles();
      const sorted = [...list].sort((a, b) => {
        if (a.host !== b.host) return a.host.localeCompare(b.host);
        if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
        const aKey = a.path ?? a.origin ?? '';
        const bKey = b.path ?? b.origin ?? '';
        return aKey.localeCompare(bKey);
      });
      allSubProfiles = sorted;
      const drafts: Record<string, string> = {};
      for (const profile of sorted) {
        drafts[profile.id] = profile.name ?? '';
      }
      subProfileNameDrafts = drafts;
    } catch (error) {
      console.error('Failed to load replacement profiles', error);
      allSubProfiles = [];
      subProfileNameDrafts = {};
    }
  }

  async function onSaveReplacementProfile(scopeOverride?: ProfileScope) {
    if (!hasSubRules) {
      toastStore.warning('Add at least one substitution rule before saving.');
      return;
    }
    if (isSavingSubProfile) return;
    isSavingSubProfile = true;
    const scope = scopeOverride ?? subProfileScope;
    try {
      const payload = getCurrentReplacementScopeInput(scope);
      const { profile, id } = await subStorage.saveSubProfile(payload);
      activeSubProfileId = id;
      activeSubProfile = profile;
      subProfileScope = scope;
      subRules = cloneSubRulesForEditing(profile.rules.slice().sort((a, b) => a.order - b.order));
      applySubToPreview = profile.applyToPreview;
      subProfileStatusMessage = buildReplacementProfileMessage(profile);
      autoAppliedSubProfile = false;
      const nextIgnored = new SvelteSet(ignoredSubProfileIds);
      if (nextIgnored.has(id)) {
        nextIgnored.delete(id);
        setIgnoredSubProfileIds(nextIgnored);
        persistIgnoredSubProfileIds(nextIgnored);
      }
      await subStorage.setPreferredSubScope(scope);
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
      toastStore.success('Saved substitution profile for this site.');
    } catch (error) {
      console.error('Failed to save substitution profile', error);
      toastStore.error('Failed to save replacement profile.');
    } finally {
      isSavingSubProfile = false;
    }
  }

  async function onDeleteReplacementProfile() {
    if (!activeSubProfileId) return;
    if (!confirm('Remove the saved substitution profile for this site?')) return;
    try {
      await subStorage.deleteSubProfile(activeSubProfileId);
      const nextIgnored = new SvelteSet(ignoredSubProfileIds);
      nextIgnored.delete(activeSubProfileId);
      setIgnoredSubProfileIds(nextIgnored);
      persistIgnoredSubProfileIds(nextIgnored);
      activeSubProfileId = null;
      activeSubProfile = null;
      subProfileStatusMessage = null;
      autoAppliedSubProfile = false;
      toastStore.success('Substitution profile removed.');
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
    } catch (error) {
      console.error('Failed to delete substitution profile', error);
      toastStore.error('Failed to delete replacement profile.');
    }
  }

  function onIgnoreReplacementProfile() {
    if (!activeSubProfileId) return;
    const next = new SvelteSet(ignoredSubProfileIds);
    next.add(activeSubProfileId);
    setIgnoredSubProfileIds(next);
    persistIgnoredSubProfileIds(next);
    subProfileStatusMessage = 'Saved substitution profile ignored for this session.';
    activeSubProfileId = null;
    activeSubProfile = null;
    autoAppliedSubProfile = false;
    toastStore.info('Saved substitution profile will be ignored until you reload the page.');
  }

  async function onApplyReplacementProfile(id: string) {
    const profile =
      hostSubProfiles.find((p) => p.id === id) ?? allSubProfiles.find((p) => p.id === id);
    if (!profile) return;
    subRules = cloneSubRulesForEditing(profile.rules.slice().sort((a, b) => a.order - b.order));
    applySubToPreview = profile.applyToPreview;
    activeSubProfileId = profile.id;
    activeSubProfile = profile;
    subProfileScope = profile.scope;
    subProfileStatusMessage = buildReplacementProfileMessage(profile);
    autoAppliedSubProfile = false;
    const next = new SvelteSet(ignoredSubProfileIds);
    if (next.has(profile.id)) {
      next.delete(profile.id);
      setIgnoredSubProfileIds(next);
      persistIgnoredSubProfileIds(next);
    }
    toastStore.success('Applied substitution profile.');
    await refreshHostReplacementProfiles();
    await loadAllSubProfiles();
  }

  async function onReplacementScopeChange(scope: ProfileScope) {
    subProfileScope = scope;
    try {
      await subStorage.setPreferredSubScope(scope);
    } catch {
      /* ignore */
    }
  }

  function getCurrentReplacementScopeInput(scope: ProfileScope): SaveSubProfileInput {
    if (typeof window === 'undefined') {
      return {
        scope,
        host: '',
        origin: '',
        path: '/',
        rules: subRules,
        applyToPreview: applySubToPreview,
      };
    }
    const { hostname, origin, pathname } = window.location;
    return {
      scope,
      host: hostname,
      origin,
      path: pathname,
      rules: subRules,
      applyToPreview: applySubToPreview,
    };
  }

  async function onAutoApplyPreferenceChange(next: boolean) {
    applyDefaultSub = next;
    try {
      await subStorage.setAutoApplySubDefault(next);
    } catch (error) {
      console.error('Failed to persist replacement auto-apply preference', error);
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

  function setReplacementRemoteMeta(payload: SubBackupPayload | null) {
    if (!payload) {
      subRemoteBackupMeta = null;
      return;
    }
    subRemoteBackupMeta = {
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

  async function refreshSubRemoteBackupMeta(showToast = false) {
    if (!ensureConfiguredForRemote(showToast)) {
      subRemoteBackupMeta = null;
      return;
    }
    if (isLoadingSubRemoteBackup) return;
    isLoadingSubRemoteBackup = true;
    try {
      const res = await fetchSubBackup(settings.serverUrl, settings.apiKey);
      if (res.success && res.data) {
        setReplacementRemoteMeta(res.data);
        if (showToast && res.message) {
          toastStore.info(res.message);
        }
      } else {
        setReplacementRemoteMeta(null);
        if (showToast) {
          toastStore.error(res.error ?? 'Failed to load substitution backup');
        }
      }
    } catch (error) {
      console.error('Failed to fetch substitution remote backup metadata', error);
      setReplacementRemoteMeta(null);
      if (showToast) {
        toastStore.error('Failed to reach gdluxx for substitution backup status.');
      }
    } finally {
      isLoadingSubRemoteBackup = false;
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

  async function onBackupReplacementProfiles() {
    if (isSavingSubRemoteBackup) return;
    if (!ensureConfiguredForRemote()) return;
    isSavingSubRemoteBackup = true;
    try {
      const bundle = await subStorage.exportSubProfiles();
      const res = await saveSubBackup(settings.serverUrl, settings.apiKey, bundle);
      if (res.success && res.data) {
        setReplacementRemoteMeta(res.data);
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
      isSavingSubRemoteBackup = false;
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

  async function onRestoreReplacementProfiles() {
    if (isRestoringSubRemoteBackup) return;
    if (!ensureConfiguredForRemote()) return;
    isRestoringSubRemoteBackup = true;
    try {
      const res = await fetchSubBackup(settings.serverUrl, settings.apiKey);
      if (!res.success || !res.data) {
        toastStore.error(res.error ?? 'Failed to load substitution backup.');
        return;
      }
      setReplacementRemoteMeta(res.data);
      if (!res.data.hasBackup) {
        toastStore.info('No remote substitution backup found for this API key.');
        return;
      }
      await subStorage.importSubProfiles(res.data.bundle);
      toastStore.success('Restored substitution profiles from gdluxx.');
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
    } catch (error) {
      console.error('Failed to restore replacement profiles from gdluxx', error);
      toastStore.error('Failed to restore replacement profiles from gdluxx.');
    } finally {
      isRestoringSubRemoteBackup = false;
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

  async function onDeleteSubRemoteBackup() {
    if (isDeletingSubRemoteBackup) return;
    if (!ensureConfiguredForRemote()) return;
    isDeletingSubRemoteBackup = true;
    try {
      const res = await deleteSubBackup(settings.serverUrl, settings.apiKey);
      if (res.success && res.data) {
        if (res.data.deleted) {
          toastStore.success('Removed remote substitution backup.');
        } else {
          toastStore.info('No remote substitution backup to delete.');
        }
        setReplacementRemoteMeta(null);
      } else {
        toastStore.error(res.error ?? 'Failed to delete remote substitution backup.');
      }
    } catch (error) {
      console.error('Failed to delete remote replacement profile backup', error);
      toastStore.error('Failed to delete remote substitution backup.');
    } finally {
      isDeletingSubRemoteBackup = false;
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

  async function onExportSubProfiles() {
    if (isExportingSubs) return;
    isExportingSubs = true;
    try {
      const bundle = await subStorage.exportSubProfiles();
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:]/g, '-');
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
      isExportingSubs = false;
    }
  }

  async function onImportSubProfiles() {
    if (!importSubProfilesText.trim()) {
      importSubProfilesError = 'Paste exported JSON before importing.';
      return;
    }
    if (isImportingSubs) return;
    isImportingSubs = true;
    importSubProfilesError = null;
    try {
      const payload = JSON.parse(importSubProfilesText);
      await subStorage.importSubProfiles(payload);
      toastStore.success('Imported substitution profiles.');
      importSubProfilesText = '';
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
    } catch (error) {
      console.error('Failed to import replacement profiles', error);
      importSubProfilesError =
        error instanceof Error ? error.message : 'Unknown error while importing profiles';
      toastStore.error('Failed to import replacement profiles.');
    } finally {
      isImportingSubs = false;
    }
  }

  async function onClearSubProfiles() {
    if (isClearingSubs) return;
    if (!confirm('Clear all saved substitution profiles?')) return;
    isClearingSubs = true;
    try {
      await subStorage.clearSubProfiles();
      activeSubProfileId = null;
      activeSubProfile = null;
      subProfileStatusMessage = null;
      autoAppliedSubProfile = false;
      const cleared = new SvelteSet<string>();
      setIgnoredSubProfileIds(cleared);
      persistIgnoredSubProfileIds(cleared);
      toastStore.success('Cleared all saved substitution profiles.');
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
    } catch (error) {
      console.error('Failed to clear replacement profiles', error);
      toastStore.error('Failed to clear replacement profiles.');
    } finally {
      isClearingSubs = false;
    }
  }

  async function onRenameSubProfile(id: string, name: string) {
    const trimmed = name.trim();
    const existing = allSubProfiles.find((p) => p.id === id);
    if (existing && (existing.name ?? '') === trimmed) return;
    try {
      await subStorage.renameSubProfile(id, trimmed);
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
    } catch (error) {
      console.error('Failed to rename replacement profile', error);
      toastStore.error('Failed to rename replacement profile.');
    }
  }

  async function onDeleteSubProfileById(id: string) {
    if (!confirm('Delete this saved substitution profile?')) return;
    try {
      await subStorage.deleteSubProfile(id);
      if (activeSubProfileId === id) {
        activeSubProfileId = null;
        activeSubProfile = null;
        subProfileStatusMessage = null;
        autoAppliedSubProfile = false;
      }
      const next = new SvelteSet(ignoredSubProfileIds);
      if (next.delete(id)) {
        setIgnoredSubProfileIds(next);
        persistIgnoredSubProfileIds(next);
      }
      toastStore.success('Deleted saved substitution profile.');
      await refreshHostReplacementProfiles();
      await loadAllSubProfiles();
    } catch (error) {
      console.error('Failed to delete substitution profile', error);
      toastStore.error('Failed to delete replacement profile.');
    }
  }

  async function onApplySubProfileFromSettings(id: string) {
    await onApplyReplacementProfile(id);
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

  function setSubImportProfilesText(value: string) {
    importSubProfilesText = value;
    importSubProfilesError = null;
  }

  function setSubProfileSearch(value: string) {
    subProfileSearch = value;
  }

  function updateSubProfileNameDraft(id: string, value: string) {
    const next = { ...subProfileNameDrafts };
    next[id] = value;
    subProfileNameDrafts = next;
  }

  function updateHoverPreviewPositionFromPoint(x: number, y: number) {
    if (settings.showImageHoverPreview === 'off') return;
    hoverPreviewPosition = computeHoverPreviewPosition(settings.showImageHoverPreview, x, y);
  }

  function getPreviewDisplayUrl(url: string | null): string | null {
    if (!url) return null;
    const modification = urlModifications.get(url);
    if (!modification) return url;
    return applySubToPreview ? modification.modifiedUrl : modification.initialUrl;
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

        <SubSection
          bind:expanded={subExpanded}
          bind:rules={subRules}
          bind:profileScope={subProfileScope}
          bind:applyToPreview={applySubToPreview}
          bind:applyDefaultSub
          {hasActiveSubs}
          {hasSubRules}
          {activeSubProfileId}
          activeProfileDiffers={activeSubProfileDiffers}
          {subProfileStatusMessage}
          autoAppliedProfile={autoAppliedSubProfile}
          isSavingProfile={isSavingSubProfile}
          hostProfiles={hostSubProfiles}
          storageWarning={subStorageWarning}
          {modifiedUrls}
          selectedItems={selected}
          previewCount={subPreviewCount}
          onapply={applySubs}
          onreset={resetSubs}
          onsaveprofile={() => onSaveReplacementProfile()}
          ondeleteprofile={onDeleteReplacementProfile}
          onignoreprofile={onIgnoreReplacementProfile}
          onscopechange={onReplacementScopeChange}
          onapplyprofile={onApplyReplacementProfile}
          onshowscopehelp={() => (showScopeHelp = true)}
          onapplydefaultchange={onAutoApplyPreferenceChange}
          onshowregexhelp={() => (showSubRegexHelp = true)}
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
        selectionCount={selected.size}
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
        {modifiedUrls}
        {urlModifications}
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
        {modifiedUrls}
        {urlModifications}
        applyToPreview={applySubToPreview}
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
            {describeSubProfile}
            onRefreshProfiles={loadAllProfiles}
            {onExportProfiles}
            {onImportProfiles}
            {onClearProfiles}
            {onBackupProfiles}
            {onRestoreProfiles}
            {onBackupReplacementProfiles}
            {onRestoreReplacementProfiles}
            onRefreshRemoteStatus={() => refreshRemoteBackupMeta(true)}
            {onDeleteRemoteBackup}
            {onApplyProfile}
            onDeleteProfile={onDeleteProfileById}
            {onRenameProfile}
            onImportTextChange={setImportProfilesText}
            onProfileSearchChange={setProfileSearch}
            onProfileDraftChange={updateProfileNameDraft}
            subProfiles={allSubProfiles}
            {filteredSubProfiles}
            {subProfileNameDrafts}
            {subProfileSearch}
            {importSubProfilesText}
            {importSubProfilesError}
            {isExportingSubs}
            {isImportingSubs}
            {isClearingSubs}
            onRefreshSubProfiles={loadAllSubProfiles}
            {onExportSubProfiles}
            {onImportSubProfiles}
            {onClearSubProfiles}
            onApplySub={onApplySubProfileFromSettings}
            onDeleteSub={onDeleteSubProfileById}
            {onRenameSubProfile}
            onSubImportTextChange={setSubImportProfilesText}
            onSubProfileSearchChange={setSubProfileSearch}
            onSubProfileDraftChange={updateSubProfileNameDraft}
            subRemoteMeta={subRemoteBackupMeta}
            {isSavingSubRemoteBackup}
            {isRestoringSubRemoteBackup}
            {isLoadingSubRemoteBackup}
            {isDeletingSubRemoteBackup}
            onRefreshSubRemoteStatus={() => refreshSubRemoteBackupMeta(true)}
            {onDeleteSubRemoteBackup}
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
    url={getPreviewDisplayUrl(hoverPreviewUrl)}
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
  {showSubRegexHelp}
  oncloseselector={() => (showSelectorHelp = false)}
  onclosescope={() => (showScopeHelp = false)}
  onclosesubregex={() => (showSubRegexHelp = false)}
/>
