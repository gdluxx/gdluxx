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
  import { Icon, Badge } from '#components/ui';
  import { ToastContainer } from '#components/ui';
  import type { ProfileScope } from '#utils/storageProfiles';
  import { registerGlobalEffects, focusElementOnce } from '#utils/globalEffects';
  import { formatTimestamp, describeSubProfile } from '#utils/formatters';
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
    ActionControls,
    ContentTabs,
    LinkList,
    ImageList,
    ContentHeader,
    FilterControls,
  } from '#views/main/components';
  import { AdvancedFiltering } from '#views/shared/filtering';
  import { SubSection } from '#views/shared/substitution';
  import StatusBar from '#views/main/StatusBar.svelte';
  import { applyThemeToShadowRoot } from '#src/content/overlayHost';
  import { createAppStore } from '#stores/app.svelte';
  import { createSelectionStore } from '#stores/selectionStore.svelte';
  import { createHoverPreviewStore } from '#stores/hoverPreviewStore.svelte';
  import { createSelectorProfileStore } from '#stores/selectorProfileStore.svelte';
  import { createSubstitutionStore } from '#stores/substitutionStore.svelte';
  import { createSettingsViewModel } from '#stores/settingsViewModel.svelte';
  import { createExtractionController } from '../lib/controllers/extractionController.svelte';
  import type { AppTab, SettingsTab } from '#src/content/types';
  import type { SubRule } from '#utils/substitution';

  const { onclose, shadowContainer } = $props();

  // Tabs and filters
  let active: AppTab = $state('images');

  const appStore = createAppStore();
  const selection = createSelectionStore();
  const hoverPreview = createHoverPreviewStore();
  const selectorProfiles = createSelectorProfileStore();
  const substitution = createSubstitutionStore();
  const settingsVM = createSettingsViewModel(appStore, appStore.settings);
  // Settings tabs
  let activeSettingsTab: SettingsTab = $state('preview');
  let startSel = $state(selectorProfiles.startSelector);
  let endSel = $state(selectorProfiles.endSelector);
  const extraction = createExtractionController(
    selection,
    substitution.clearModifications,
    () => active as AppTab,
    () => ({ startSel, endSel }),
  );
  const settings = appStore.settings;
  const isConfigured = $derived(appStore.isConfigured);

  const links = $derived(extraction.links);
  const images = $derived(extraction.images);
  const linkCounts = $derived(extraction.linkCounts);
  const imageCounts = $derived(extraction.imageCounts);

  // Theme preferences
  let currentTheme = $state(appStore.theme);

  // Display preference
  let isFullscreen = $state(appStore.isFullscreen);

  // Range feedback
  const rangeHint = $derived(extraction.rangeHint);

  let lastStartSel = selectorProfiles.startSelector;
  let lastEndSel = selectorProfiles.endSelector;

  $effect(() => {
    const next = selectorProfiles.startSelector;
    if (next !== lastStartSel) {
      lastStartSel = next;
      startSel = next;
    }
  });

  $effect(() => {
    if (startSel !== lastStartSel) {
      lastStartSel = startSel;
      selectorProfiles.setStartSelector(startSel);
    }
  });

  $effect(() => {
    const next = selectorProfiles.endSelector;
    if (next !== lastEndSel) {
      lastEndSel = next;
      endSel = next;
    }
  });

  $effect(() => {
    if (endSel !== lastEndSel) {
      lastEndSel = endSel;
      selectorProfiles.setEndSelector(endSel);
    }
  });

  $effect(() => {
    selectorProfiles.setRangeHint(rangeHint);
  });

  // Advanced section state
  let advancedExpanded = $state(false);
  const hasActiveFilters = $derived(!!(startSel.trim() || endSel.trim()));
  let showSelectorHelp = $state(false);
  let showScopeHelp = $state(false);
  let showSubRegexHelp = $state(false);

  // Substitution profiles and rules
  let subRules = $state<SubRule[]>(substitution.rules);
  let subExpanded = $state(substitution.expanded);
  let subProfileScope = $state<ProfileScope>(substitution.scope);
  let applySubToPreview = $state(substitution.applyToPreview);
  let applyDefaultSub = $state(substitution.applyDefaultSub);

  // sync substitution store bindings with directional guards
  let lastSubRules = substitution.rules;
  let lastSubScope = substitution.scope;
  let lastApplyPreview = substitution.applyToPreview;
  let lastApplyDefault = substitution.applyDefaultSub;
  let lastSubExpanded = substitution.expanded;

  $effect(() => {
    const nextRules = substitution.rules;
    if (nextRules !== lastSubRules) {
      lastSubRules = nextRules;
      subRules = nextRules;
    }
  });

  $effect(() => {
    if (subRules !== lastSubRules) {
      lastSubRules = subRules;
      substitution.setRules(subRules);
    }
  });

  $effect(() => {
    const nextScope = substitution.scope;
    if (nextScope !== lastSubScope) {
      lastSubScope = nextScope;
      subProfileScope = nextScope;
    }
  });

  $effect(() => {
    if (subProfileScope !== lastSubScope) {
      lastSubScope = subProfileScope;
      substitution.setScope(subProfileScope);
    }
  });

  $effect(() => {
    const nextApplyPreview = substitution.applyToPreview;
    if (nextApplyPreview !== lastApplyPreview) {
      lastApplyPreview = nextApplyPreview;
      applySubToPreview = nextApplyPreview;
    }
  });

  $effect(() => {
    if (applySubToPreview !== lastApplyPreview) {
      lastApplyPreview = applySubToPreview;
      substitution.setApplyToPreview(applySubToPreview);
    }
  });

  $effect(() => {
    const nextApplyDefault = substitution.applyDefaultSub;
    if (nextApplyDefault !== lastApplyDefault) {
      lastApplyDefault = nextApplyDefault;
      applyDefaultSub = nextApplyDefault;
    }
  });

  $effect(() => {
    if (applyDefaultSub !== lastApplyDefault) {
      lastApplyDefault = applyDefaultSub;
      substitution.setApplyDefault(applyDefaultSub);
    }
  });

  $effect(() => {
    const nextExpanded = substitution.expanded;
    if (nextExpanded !== lastSubExpanded) {
      lastSubExpanded = nextExpanded;
      subExpanded = nextExpanded;
    }
  });

  $effect(() => {
    if (subExpanded !== lastSubExpanded) {
      lastSubExpanded = subExpanded;
      substitution.setExpanded(subExpanded);
    }
  });

  const activeSubProfileDiffers = $derived(substitution.activeProfileDiffers);

  $effect(() => {
    substitution.calculatePreviewCount(Array.from(selection.selected));
  });

  const filteredSubProfiles = $derived(substitution.filteredProfiles);

  const serverUrlError = $derived(settingsVM.serverUrlError);
  const apiKeyError = $derived(settingsVM.apiKeyError);
  const isTestingConnection = $derived(settingsVM.isTestingConnection);
  const isSavingSettings = $derived(settingsVM.isSavingSettings);

  // derived filtered arrays
  const filteredLinks = $derived(extraction.filteredLinks);
  const filteredImages = $derived(extraction.filteredImages);
  const visible = $derived(extraction.visible);

  // Using selector profile store's derived values
  const hasActiveProfile = $derived(selectorProfiles.hasActiveProfile);
  const activeProfileDiffers = $derived(selectorProfiles.activeProfileDiffers);
  const hasSelectors = $derived(selectorProfiles.hasSelectors);
  const filteredProfiles = $derived(selectorProfiles.filteredProfiles);

  function populate() {
    extraction.populate();
  }

  function applySubs() {
    const result = substitution.applyToSelected(
      Array.from(selection.selected),
      links,
      images,
      linkCounts,
      imageCounts,
    );
    extraction.setData({
      links: result.links,
      images: result.images,
      linkCounts: result.linkCounts,
      imageCounts: result.imageCounts,
    });
    selection.replace(result.newSelection);
  }

  function resetSubs() {
    if (
      substitution.modifiedUrls.size > 0 &&
      !confirm(
        `Reset all URL modifications (${substitution.modifiedUrls.size} URL${substitution.modifiedUrls.size === 1 ? '' : 's'})? This cannot be undone.`,
      )
    ) {
      return;
    }

    const result = substitution.resetModifications(links, images, linkCounts, imageCounts);
    if (!result) return;

    extraction.setData({
      links: result.links,
      images: result.images,
      linkCounts: result.linkCounts,
      imageCounts: result.imageCounts,
    });
    selection.replace(result.newSelection);
  }

  async function init() {
    try {
      await appStore.hydrate();
      await selection.initialize();
      currentTheme = appStore.theme;
      isFullscreen = appStore.isFullscreen;
      if (shadowContainer) {
        const shadowRoot = shadowContainer.getRootNode() as ShadowRoot;
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
    await selectorProfiles.initialize(window.location.href);
    // Force sync after initializing
    const newStart = selectorProfiles.startSelector;
    const newEnd = selectorProfiles.endSelector;
    startSel = newStart;
    endSel = newEnd;
    lastStartSel = newStart;
    lastEndSel = newEnd;
  }

  async function initializeSubProfiles() {
    if (typeof window === 'undefined') return;
    await substitution.initialize(window.location.href);
  }

  async function onSaveReplacementProfile(scopeOverride?: ProfileScope) {
    await substitution.saveProfile(scopeOverride);
  }

  async function onDeleteReplacementProfile() {
    await substitution.deleteProfile();
  }

  function onIgnoreReplacementProfile() {
    substitution.ignoreProfile();
  }

  async function onApplyReplacementProfile(id: string) {
    await substitution.applyProfile(id);
  }

  async function onReplacementScopeChange(scope: ProfileScope) {
    substitution.setScope(scope);
  }

  async function onAutoApplyPreferenceChange(next: boolean) {
    substitution.setApplyDefault(next);
  }

  // Wrapper for selector profiles
  async function onSaveProfile(scopeOverride?: ProfileScope) {
    await selectorProfiles.saveProfile(scopeOverride);
    populate();
  }

  async function onDeleteProfile() {
    await selectorProfiles.deleteProfile();
    populate();
  }

  function onIgnoreProfile() {
    selectorProfiles.ignoreProfile();
  }

  async function onApplyProfile(id: string) {
    await selectorProfiles.applyProfile(id);
    populate();
  }

  async function onScopeChange(scope: ProfileScope) {
    selectorProfiles.setScope(scope);
  }

  async function refreshRemoteBackupMeta(showToast = false) {
    await selectorProfiles.refreshRemoteBackupMeta(settings.serverUrl, settings.apiKey, showToast);
  }

  async function refreshSubRemoteBackupMeta(showToast = false) {
    await substitution.refreshRemoteBackupMeta(settings.serverUrl, settings.apiKey, showToast);
  }

  async function onBackupProfiles() {
    await selectorProfiles.backupToRemote(settings.serverUrl, settings.apiKey);
  }

  async function onBackupReplacementProfiles() {
    await substitution.backupToRemote(settings.serverUrl, settings.apiKey);
  }

  async function onRestoreProfiles() {
    await selectorProfiles.restoreFromRemote(settings.serverUrl, settings.apiKey);
  }

  async function onRestoreReplacementProfiles() {
    await substitution.restoreFromRemote(settings.serverUrl, settings.apiKey);
  }

  async function onDeleteRemoteBackup() {
    await selectorProfiles.deleteRemoteBackup(settings.serverUrl, settings.apiKey);
  }

  async function onDeleteSubRemoteBackup() {
    await substitution.deleteRemoteBackup(settings.serverUrl, settings.apiKey);
  }

  async function onExportProfiles() {
    await selectorProfiles.exportProfiles();
  }

  async function onImportProfiles() {
    await selectorProfiles.importProfiles();
  }

  async function onClearProfiles() {
    await selectorProfiles.clearProfiles();
  }

  async function onRenameProfile(id: string, name: string) {
    await selectorProfiles.renameProfile(id, name);
  }

  async function onDeleteProfileById(id: string) {
    await selectorProfiles.deleteProfileById(id);
    populate();
  }

  async function onExportSubProfiles() {
    await substitution.exportProfiles();
  }

  async function onImportSubProfiles() {
    await substitution.importProfiles();
  }

  async function onClearSubProfiles() {
    await substitution.clearProfiles();
  }

  async function onRenameSubProfile(id: string, name: string) {
    await substitution.renameProfile(id, name);
  }

  async function onDeleteSubProfileById(id: string) {
    await substitution.deleteProfileById(id);
  }

  async function onApplySubProfileFromSettings(id: string) {
    await substitution.applyProfile(id);
  }

  async function refreshSubProfiles() {
    if (typeof window === 'undefined') return;
    await substitution.refreshHostProfiles(window.location.href);
    await substitution.refreshAllProfiles();
  }

  async function onTest() {
    await settingsVM.test();
  }

  async function onSave() {
    await settingsVM.save();
  }

  async function onThemeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const value = target.value;
    currentTheme = value;

    if (shadowContainer) {
      const shadowRoot = shadowContainer.getRootNode() as ShadowRoot;
      applyThemeToShadowRoot(shadowRoot, value);
    }

    await settingsVM.setTheme(value);
  }

  async function onToggleDisplayMode() {
    await settingsVM.toggleDisplayMode();
  }

  async function onReset() {
    await settingsVM.reset();
  }

  async function onToggleImagePreviews(event: Event) {
    const input = event.target as HTMLInputElement;
    await settingsVM.setImagePreviews(input.checked, input);
  }

  async function onToggleImageHoverPreview(event: Event) {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;
    const next = select.value as 'off' | 'small' | 'medium' | 'large';
    await settingsVM.setHoverPreview(next, select);
  }

  async function onToggleHotkey(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await settingsVM.toggleHotkey(input.checked, input);
  }

  async function onHotkeyChange(newHotkey: string): Promise<void> {
    await settingsVM.setHotkey(newHotkey);
  }

  async function onToggleSendTabHotkey(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await settingsVM.toggleSendTabHotkey(input.checked, input);
  }

  async function onSendTabHotkeyChange(newHotkey: string): Promise<void> {
    await settingsVM.setSendTabHotkey(newHotkey);
  }

  function onServerUrlChange(value: string) {
    settingsVM.setServerUrl(value);
    settingsVM.clearServerUrlError();
  }

  function onApiKeyChange(value: string) {
    settingsVM.setApiKey(value);
    settingsVM.clearApiKeyError();
  }

  function setImportProfilesText(value: string) {
    selectorProfiles.setImportText(value);
  }

  function setProfileSearch(value: string) {
    selectorProfiles.setProfileSearch(value);
  }

  function updateProfileNameDraft(id: string, value: string) {
    selectorProfiles.updateNameDraft(id, value);
  }

  function setSubImportProfilesText(value: string) {
    substitution.setImportText(value);
  }

  function setSubProfileSearch(value: string) {
    substitution.setProfileSearch(value);
  }

  function updateSubProfileNameDraft(id: string, value: string) {
    substitution.updateNameDraft(id, value);
  }

  function getPreviewDisplayUrl(url: string | null): string | null {
    if (!url) return null;
    const modification = substitution.urlModifications.get(url);
    if (!modification) return url;
    return applySubToPreview ? modification.modifiedUrl : modification.initialUrl;
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
        !(
          selectorProfiles.isSaving ||
          !hasSelectors ||
          (hasActiveProfile && !activeProfileDiffers)
        ),
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
    const nextFullscreen = appStore.isFullscreen;
    if (isFullscreen !== nextFullscreen) {
      isFullscreen = nextFullscreen;
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
    hoverPreview.hideIfDisabled(settings);
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
  style="font-size: 12px !important; line-height: 1.5 !important; text-align: left !important; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif !important;"
>
  <div class="{isFullscreen ? '' : 'rounded-t-md'} bg-base-100">
    <!-- Header Section -->
    <div class="border-base-300 border-b px-6 py-2">
      <div class="flex items-center justify-between">
        <ContentHeader
          {active}
          linkCount={filteredLinks.length}
          imageCount={filteredImages.length}
        />
        <ul class="menu menu-horizontal bg-base-200 rounded-box">
          <!-- Only show accordion toggles when not in settings -->
          {#if active !== 'settings'}
            <li>
              <button
                title={advancedExpanded ? 'Hide Advanced Filtering' : 'Show Advanced Filtering'}
                aria-label={advancedExpanded
                  ? 'Hide Advanced Filtering'
                  : 'Show Advanced Filtering'}
                class="relative {advancedExpanded ? 'bg-primary text-primary-content' : ''}"
                onclick={() => {
                  advancedExpanded = !advancedExpanded;
                }}
              >
                <Icon
                  iconName="filter-outline"
                  class={advancedExpanded ? 'text-primary-content' : 'text-base-content'}
                  size={16}
                />
                {#if hasActiveFilters && !advancedExpanded}
                  <Badge
                    label="Active"
                    variant="info"
                    class="absolute -top-1 -right-1 scale-75"
                  />
                {/if}
              </button>
            </li>
            <li>
              <button
                title={subExpanded ? 'Hide String Substitution' : 'Show String Substitution'}
                aria-label={subExpanded ? 'Hide String Substitution' : 'Show String Substitution'}
                class="relative {subExpanded ? 'bg-primary text-primary-content' : ''}"
                onclick={() => {
                  subExpanded = !subExpanded;
                }}
              >
                <Icon
                  iconName="find-replace"
                  class={subExpanded ? 'text-primary-content' : 'text-base-content'}
                  size={16}
                />
                {#if substitution.hasActiveSubs && !subExpanded}
                  <Badge
                    label="Active"
                    variant="info"
                    class="absolute -top-1 -right-1 scale-75"
                  />
                {/if}
              </button>
            </li>
          {/if}

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
                class="text-base-content"
                size={16}
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
                class="text-base-content"
                size={16}
              />
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Expandable Sections when not in settings -->
    {#if active !== 'settings'}
      <!-- Advanced Filtering -->
      {#if advancedExpanded}
        <div class="border-base-300 bg-base-200 border-b px-6 py-6">
          <AdvancedFiltering
            bind:expanded={advancedExpanded}
            {hasActiveFilters}
            bind:startSelector={startSel}
            bind:endSelector={endSel}
            profileScope={selectorProfiles.scope}
            {hasSelectors}
            {hasActiveProfile}
            {activeProfileDiffers}
            profileStatusMessage={selectorProfiles.statusMessage}
            autoAppliedProfile={selectorProfiles.autoAppliedProfile}
            isSavingProfile={selectorProfiles.isSaving}
            hostProfiles={selectorProfiles.hostProfiles}
            {rangeHint}
            storageWarning={selectorProfiles.storageWarning}
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
      {/if}

      <!-- String Substitution -->
      {#if subExpanded}
        <div class="border-base-300 bg-base-200 border-b px-6 py-6">
          <SubSection
            bind:expanded={subExpanded}
            bind:rules={subRules}
            bind:profileScope={subProfileScope}
            bind:applyToPreview={applySubToPreview}
            bind:applyDefaultSub
            hasActiveSubs={substitution.hasActiveSubs}
            hasSubRules={substitution.hasSubRules}
            activeSubProfileId={substitution.activeProfileId}
            activeProfileDiffers={activeSubProfileDiffers}
            subProfileStatusMessage={substitution.statusMessage}
            autoAppliedProfile={substitution.autoAppliedProfile}
            isSavingProfile={substitution.isSaving}
            hostProfiles={substitution.hostProfiles}
            storageWarning={substitution.storageWarning}
            modifiedUrls={substitution.modifiedUrls}
            selectedItems={selection.selected}
            previewCount={substitution.previewCount}
            onapply={applySubs}
            onreset={resetSubs}
            onsaveprofile={() => onSaveReplacementProfile()}
            ondeleteprofile={onDeleteReplacementProfile}
            onignoreprofile={onIgnoreReplacementProfile}
            onscopechange={(scope) => onReplacementScopeChange(scope)}
            onapplyprofile={(profileId) => onApplyReplacementProfile(profileId)}
            onshowscopehelp={() => (showScopeHelp = true)}
            onapplydefaultchange={onAutoApplyPreferenceChange}
            onshowregexhelp={() => (showSubRegexHelp = true)}
          />
        </div>
      {/if}

      <!-- FilterControls, always visible when not settings -->
      <div class="border-base-300 bg-base-200 border-b px-6 py-4">
        <FilterControls
          value={selection.filter}
          onchange={(value) => selection.setFilter(value)}
          bind:inputEl={filterEl}
        />
      </div>

      <ActionControls
        {isConfigured}
        selectionCount={selection.selected.size}
        onCopySelected={() => selection.copyToClipboard([...selection.selected])}
        onDownloadSelected={() =>
          selection.downloadAsFile([...selection.selected], `${active}_export.txt`)}
        onSendSelected={() => selection.sendToServer([...selection.selected])}
        customDirectoryEnabled={selection.customDirectoryEnabled}
        customDirectoryValue={selection.customDirectoryValue}
        onCustomDirectoryToggle={() =>
          selection.setCustomDirectory(!selection.customDirectoryEnabled)}
        onCustomDirectoryChange={(value) =>
          selection.setCustomDirectory(selection.customDirectoryEnabled, value)}
        onCustomDirectoryClear={() => selection.setCustomDirectory(false, '')}
      />

      <!-- ContentTabs -->
      <ContentTabs
        {active}
        imageCount={filteredImages.length}
        linkCount={filteredLinks.length}
        selectionCount={selection.selected.size}
        onchange={(tab) => (active = tab)}
        onSelectAll={() => selection.selectAll(visible)}
        onSelectNone={() => selection.selectNone()}
        onInvertSelection={() => selection.invertSelection(visible)}
      />
    {/if}
  </div>

  <div class="border-base-300 bg-base-100 min-h-0 flex-1 overflow-auto border-b px-6">
    {#if active === 'links'}
      <LinkList
        links={filteredLinks}
        counts={linkCounts}
        selected={selection.selected}
        compact={selection.compact}
        onToggle={(url) => selection.toggle(url)}
        modifiedUrls={substitution.modifiedUrls}
        urlModifications={substitution.urlModifications}
      />
    {:else if active === 'images'}
      <ImageList
        images={filteredImages}
        counts={imageCounts}
        selected={selection.selected}
        compact={selection.compact}
        showHoverPreview={(url, event) => hoverPreview.show(url, event, settings)}
        updateHoverPosition={(event) => hoverPreview.updatePosition(event, settings)}
        hideHoverPreview={() => hoverPreview.hide()}
        onToggle={(url) => selection.toggle(url)}
        showImagePreviews={settings.showImagePreviews}
        modifiedUrls={substitution.modifiedUrls}
        urlModifications={substitution.urlModifications}
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
            onServerUrlInput={onServerUrlChange}
            onApiKeyInput={onApiKeyChange}
            {onTest}
            {onSave}
            {onReset}
          />

          <ProfileManager
            {isConfigured}
            {isSavingSettings}
            {isTestingConnection}
            isSavingRemoteBackup={selectorProfiles.isSavingRemoteBackup}
            isRestoringRemoteBackup={selectorProfiles.isRestoringRemoteBackup}
            isLoadingRemoteBackup={selectorProfiles.isLoadingRemoteBackup}
            isDeletingRemoteBackup={selectorProfiles.isDeletingRemoteBackup}
            isExportingProfiles={selectorProfiles.isExporting}
            isImportingProfiles={selectorProfiles.isImporting}
            isClearingProfiles={selectorProfiles.isClearing}
            allProfiles={selectorProfiles.allProfiles}
            {filteredProfiles}
            profileNameDrafts={selectorProfiles.profileNameDrafts}
            profileSearch={selectorProfiles.profileSearch}
            importProfilesText={selectorProfiles.importText}
            importProfilesError={selectorProfiles.importError}
            remoteBackupMeta={selectorProfiles.remoteBackupMeta}
            {formatTimestamp}
            describeProfile={(profile) => profile.name || `${profile.host} (${profile.scope})`}
            {describeSubProfile}
            onRefreshProfiles={() => selectorProfiles.refreshHostProfiles(window.location.href)}
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
            subProfiles={substitution.allProfiles}
            {filteredSubProfiles}
            subProfileNameDrafts={substitution.profileNameDrafts}
            subProfileSearch={substitution.profileSearch}
            importSubProfilesText={substitution.importText}
            importSubProfilesError={substitution.importError}
            isExportingSubs={substitution.isExporting}
            isImportingSubs={substitution.isImporting}
            isClearingSubs={substitution.isClearing}
            onRefreshSubProfiles={refreshSubProfiles}
            {onExportSubProfiles}
            {onImportSubProfiles}
            {onClearSubProfiles}
            onApplySub={onApplySubProfileFromSettings}
            onDeleteSub={onDeleteSubProfileById}
            {onRenameSubProfile}
            onSubImportTextChange={setSubImportProfilesText}
            onSubProfileSearchChange={setSubProfileSearch}
            onSubProfileDraftChange={updateSubProfileNameDraft}
            subRemoteMeta={substitution.remoteBackupMeta}
            isSavingSubRemoteBackup={substitution.isSavingRemoteBackup}
            isRestoringSubRemoteBackup={substitution.isRestoringRemoteBackup}
            isLoadingSubRemoteBackup={substitution.isLoadingRemoteBackup}
            isDeletingSubRemoteBackup={substitution.isDeletingRemoteBackup}
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
          <KeyboardTab
            {settings}
            {onToggleHotkey}
            {onHotkeyChange}
            {onToggleSendTabHotkey}
            {onSendTabHotkeyChange}
          />
        {/if}
      </div>
    {/if}
  </div>

  <StatusBar
    activeTab={active}
    visibleCount={visible.length}
    totalLinks={links.length}
    totalImages={images.length}
    selectedCount={selection.selected.size}
    compact={selection.compact}
    onCompactChange={(checked) => selection.setCompact(checked)}
  />

  <HoverPreview
    visible={settings.showImageHoverPreview !== 'off' && hoverPreview.visible}
    url={getPreviewDisplayUrl(hoverPreview.url)}
    position={hoverPreview.position}
    mode={settings.showImageHoverPreview}
    hasError={hoverPreview.imageError}
    onerror={() => hoverPreview.setImageError(true)}
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
