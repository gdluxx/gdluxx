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
  /* global Event, HTMLSelectElement */
  import { untrack } from 'svelte';
  import { Icon } from '#components/ui';
  import { ToastContainer } from '#components/ui';
  import { registerGlobalEffects, focusElementOnce } from '#utils/globalEffects';
  import HoverPreview from '#views/shared/overlays/HoverPreview.svelte';
  import HelpModals from '#views/shared/modals/HelpModals.svelte';
  import {
    AppearanceTab,
    CookiesTab,
    ExtractionProfilesTab,
    GdluxxTab,
    KeyboardTab,
    PreviewTab,
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
  import { ExtractionSection } from '#views/shared/extraction';
  import StatusBar from '#views/main/StatusBar.svelte';
  import { applyThemeToShadowRoot } from '#src/content/overlayHost';
  import { createAppStore } from '#stores/app.svelte';
  import { createSelectionStore } from '#stores/selectionStore.svelte';
  import { createHoverPreviewStore } from '#stores/hoverPreviewStore.svelte';
  import { createExtractionProfileStore } from '#stores/extractionProfileStore.svelte';
  import { createSettingsViewModel } from '#stores/settingsViewModel.svelte';
  import { createSentHistoryStore } from '#stores/sentHistoryStore.svelte';
  import { createExtractionController } from '../lib/controllers/extractionController.svelte';
  import { readDirAutoFillOptOuts, resolveDirectoryFromSource } from '#utils/directorySource';
  import { isActive as accumulatorIsActive, onChange, snapshot } from '#utils/scrollAccumulator';
  import { toastStore } from '#stores/toast';
  import type { AppTab, DirectorySource, SettingsTab } from '#src/content/types';

  const { onclose, shadowContainer } = $props();

  let active: AppTab = $state('images');

  const appStore = createAppStore();
  const selection = createSelectionStore();
  const hoverPreview = createHoverPreviewStore();
  const extractionProfiles = createExtractionProfileStore();
  const settingsVM = createSettingsViewModel(appStore, appStore.settings);
  const sentHistory = createSentHistoryStore();

  let activeSettingsTab: SettingsTab = $state('preview');
  const settings = appStore.settings;
  const isConfigured = $derived(appStore.isConfigured);

  const extraction = createExtractionController(
    selection,
    extractionProfiles.clearModifications,
    () => active as AppTab,
    () => extractionProfiles.extraction,
  );

  const links = $derived(extraction.links);
  const images = $derived(extraction.images);
  const linkCounts = $derived(extraction.linkCounts);
  const imageCounts = $derived(extraction.imageCounts);
  const allExtractedUrls = $derived(extraction.allUrls);

  let currentTheme = $state(appStore.theme);
  let isFullscreen = $state(appStore.isFullscreen);
  const rangeHint = $derived(extraction.rangeHint);

  // Advanced section (unified extraction + rules panel)
  let advancedExpanded = $state(false);
  const hasActiveContent = $derived(
    extractionProfiles.hasActiveFilters ||
      extractionProfiles.hasActiveRules ||
      extractionProfiles.hasDirectorySource,
  );
  let showSelectorHelp = $state(false);
  let showScopeHelp = $state(false);
  let showSubRegexHelp = $state(false);

  const serverUrlError = $derived(settingsVM.serverUrlError);
  const apiKeyError = $derived(settingsVM.apiKeyError);
  const isTestingConnection = $derived(settingsVM.isTestingConnection);
  const isSavingSettings = $derived(settingsVM.isSavingSettings);

  const filteredLinks = $derived(extraction.filteredLinks);
  const filteredImages = $derived(extraction.filteredImages);
  const visible = $derived(extraction.visible);

  function populate(options: { applyAutoSubstitutions?: boolean } = {}) {
    extraction.populate();
    if (!options.applyAutoSubstitutions) return;
    if (!extractionProfiles.autoAppliedProfile || !extractionProfiles.hasActiveRules) return;

    const result = extractionProfiles.applyToAll(links, images, linkCounts, imageCounts);
    if (result.modifiedCount === 0) return;

    extraction.setData({
      links: result.links,
      images: result.images,
      linkCounts: result.linkCounts,
      imageCounts: result.imageCounts,
    });
  }

  function applySubs() {
    const result = extractionProfiles.applyToSelected(
      [...selection.selected],
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
      extractionProfiles.modifiedUrls.size > 0 &&
      !confirm(
        `Reset all URL modifications (${extractionProfiles.modifiedUrls.size} URL${extractionProfiles.modifiedUrls.size === 1 ? '' : 's'})? This cannot be undone.`,
      )
    ) {
      return;
    }

    const result = extractionProfiles.resetModifications(links, images, linkCounts, imageCounts);
    if (!result) return;

    extraction.setData({
      links: result.links,
      images: result.images,
      linkCounts: result.linkCounts,
      imageCounts: result.imageCounts,
    });
    selection.replace(result.newSelection);
  }

  function shouldMergeAccumulated(): boolean {
    return accumulatorIsActive() && extractionProfiles.extraction.mode === 'targeted';
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
      // sentHistory only touches local storage - initialize it before the
      // network bound initializeExtraction() so badges aren't blocked on it
      if (typeof window !== 'undefined') {
        await sentHistory.initialize(window.location.hostname);
      }
      await initializeExtraction();
    } finally {
      populate({ applyAutoSubstitutions: true });
      if (shouldMergeAccumulated()) extraction.mergeImages(snapshot());
    }
  }
  init();

  $effect(() => {
    return () => sentHistory.dispose();
  });

  $effect(() => {
    const unsubscribe = onChange(() => {
      if (!shouldMergeAccumulated()) return;
      extraction.mergeImages(snapshot());
    });
    return unsubscribe;
  });

  async function initializeExtraction() {
    if (typeof window === 'undefined') return;
    await extractionProfiles.initialize(window.location.href);
    await extractionProfiles.fetchBackupMeta(settings.serverUrl, settings.apiKey);
  }

  async function onSaveProfile() {
    await extractionProfiles.saveProfile();
    populate();
  }

  async function onDeleteProfile() {
    await extractionProfiles.deleteProfile();
    populate();
  }

  async function onApplyProfile(id: string) {
    await extractionProfiles.applyProfile(id);
    populate();
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

  async function onToggleSentMarks(event: Event) {
    const input = event.target as HTMLInputElement;
    await settingsVM.setShowSentMarks(input.checked, input);
  }

  async function onClearSentHistory(scope: 'host' | 'all') {
    const label = scope === 'host' ? 'this site' : 'all sites';
    if (!confirm(`Clear sent-URL history for ${label}?`)) return;
    await sentHistory.clear(scope);
    toastStore.success(`Cleared sent-URL history for ${label}.`);
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

  async function onToggleGalleryHotkey(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await settingsVM.toggleGalleryHotkey(input.checked, input);
  }

  async function onGalleryHotkeyChange(newHotkey: string): Promise<void> {
    await settingsVM.setGalleryHotkey(newHotkey);
  }

  function onServerUrlChange(value: string) {
    settingsVM.setServerUrl(value);
    settingsVM.clearServerUrlError();
  }

  function onApiKeyChange(value: string) {
    settingsVM.setApiKey(value);
    settingsVM.clearApiKeyError();
  }

  function getPreviewDisplayUrl(url: string | null): string | null {
    if (!url) return null;
    const modification = extractionProfiles.urlModifications.get(url);
    if (!modification) return url;
    return extractionProfiles.applyToPreview ? modification.modifiedUrl : modification.initialUrl;
  }

  function applyDirectorySourceAutoFill(source: DirectorySource | null | undefined) {
    // An empty selector is "no source" everywhere else (storage strips it), so
    // it must not surface as a resolution failure here either.
    if (!source?.selector.trim()) {
      selection.clearAutoFilledDirectory();
      return;
    }
    if (typeof window === 'undefined') return;
    // Dismissed on this page earlier in the session - stay out of the way
    if (readDirAutoFillOptOuts().has(window.location.href)) return;
    // Never overwrite a manually set directory name
    if (!selection.canAcceptAutoFill) return;

    const { value, reason } = resolveDirectoryFromSource(source);
    if (value) {
      selection.autoFillDirectory(value);
    } else {
      selection.autoFillDirectoryFailed(reason ?? 'Could not read a folder name from this page');
    }
  }

  // Auto-fill is keyed on the active profile: initial auto-apply, manual apply,
  // ignore and delete all move through activeProfileId
  let lastDirSourceProfileId: string | null | undefined;
  $effect(() => {
    const profileId = extractionProfiles.activeProfileId;
    untrack(() => {
      if (lastDirSourceProfileId === profileId) return;
      lastDirSourceProfileId = profileId;
      applyDirectorySourceAutoFill(extractionProfiles.directorySource);
    });
  });

  // Accessibility: focus filter on open, Esc to close
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
          extractionProfiles.isSaving ||
          (!extractionProfiles.hasActiveFilters &&
            !extractionProfiles.hasActiveRules &&
            !extractionProfiles.hasDirectorySource) ||
          (!!extractionProfiles.activeProfileId && !extractionProfiles.activeProfileDiffers)
        ),
      saveProfile: () => onSaveProfile(),
    }),
  );

  $effect(() => {
    const nextTheme = appStore.theme;
    if (currentTheme !== nextTheme) currentTheme = nextTheme;
  });

  $effect(() => {
    const nextFullscreen = appStore.isFullscreen;
    if (isFullscreen !== nextFullscreen) isFullscreen = nextFullscreen;
  });

  $effect(() => {
    if (!shadowContainer) return;
    const root = shadowContainer.getRootNode();
    if (root instanceof ShadowRoot) applyThemeToShadowRoot(root, currentTheme);
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
        <ul class="menu menu-horizontal bg-base-200 rounded-box gap-1">
          {#if active !== 'settings'}
            <li>
              <button
                title={advancedExpanded ? 'Hide Extraction' : 'Show Extraction'}
                aria-label={advancedExpanded ? 'Hide Extraction' : 'Show Extraction'}
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
                {#if hasActiveContent && !advancedExpanded}
                  <span class="bg-info absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"></span>
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

    <!-- Extraction panel (unified filtering + substitution) -->
    {#if active !== 'settings'}
      {#if advancedExpanded}
        <div class="border-base-300 bg-base-200 max-h-[500px] overflow-y-auto border-b px-4 py-2">
          <ExtractionSection
            bind:expanded={advancedExpanded}
            extraction={extractionProfiles.extraction}
            bind:rules={extractionProfiles.rules}
            profileScope={extractionProfiles.scope}
            applyToPreview={extractionProfiles.applyToPreview}
            {hasActiveContent}
            hasActiveProfile={!!extractionProfiles.activeProfileId}
            activeProfileDiffers={extractionProfiles.activeProfileDiffers}
            statusMessage={extractionProfiles.statusMessage}
            autoAppliedProfile={extractionProfiles.autoAppliedProfile}
            isSaving={extractionProfiles.isSaving}
            hostProfiles={extractionProfiles.hostProfiles}
            {rangeHint}
            storageWarning={extractionProfiles.storageWarning}
            modifiedUrls={extractionProfiles.modifiedUrls}
            selectedItems={selection.selected}
            {allExtractedUrls}
            directorySource={extractionProfiles.directorySource}
            accumulate={extractionProfiles.accumulate}
            onmodechange={(mode) => extractionProfiles.setExtractionMode(mode)}
            ondirectorysourcechange={(src) => extractionProfiles.setDirectorySource(src)}
            onaccumulatechange={(v) => extractionProfiles.setAccumulate(v)}
            onstartselectorchange={(val) => extractionProfiles.setStartSelector(val)}
            onendselectorchange={(val) => extractionProfiles.setEndSelector(val)}
            oncontainersourcechange={(src) => extractionProfiles.setContainerSource(src)}
            onimagesourcechange={(src) => extractionProfiles.setImageSource(src)}
            onapplyextraction={populate}
            onapplysubstitutions={applySubs}
            onreset={resetSubs}
            onsaveprofile={() => onSaveProfile()}
            ondeleteprofile={onDeleteProfile}
            onignoreprofile={() => extractionProfiles.ignoreProfile()}
            onscopechange={(s) => extractionProfiles.setScope(s)}
            onapplyprofile={(id) => onApplyProfile(id)}
            onapplytopreviewchange={(val) => extractionProfiles.setApplyToPreview(val)}
            onshowscopehelp={() => (showScopeHelp = true)}
            onshowselectorhelp={() => (showSelectorHelp = true)}
            onshowregexhelp={() => (showSubRegexHelp = true)}
          />
        </div>
      {/if}

      <div class="border-base-300 bg-base-200 border-b px-6 py-2">
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
        siteDirEnabled={selection.siteDirEnabled}
        onSiteDirToggle={() => selection.setSiteDirectory(!selection.siteDirEnabled)}
        currentHostname={typeof window !== 'undefined' ? window.location.hostname : ''}
        autoFillFailedReason={selection.autoFillFailedReason}
        isAutoFilled={selection.isAutoFilled}
      />

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
        modifiedUrls={extractionProfiles.modifiedUrls}
        urlModifications={extractionProfiles.urlModifications}
        sentStatuses={sentHistory.enabled ? sentHistory.statuses : new Map()}
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
        modifiedUrls={extractionProfiles.modifiedUrls}
        urlModifications={extractionProfiles.urlModifications}
        applyToPreview={extractionProfiles.applyToPreview}
        sentStatuses={sentHistory.enabled ? sentHistory.statuses : new Map()}
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
            showSentMarks={settings.showSentMarks}
            {onToggleDisplayMode}
            {onToggleImagePreviews}
            {onToggleImageHoverPreview}
            {onToggleSentMarks}
            {onClearSentHistory}
          />
        {/if}
        {#if activeSettingsTab === 'keyboard'}
          <KeyboardTab
            {settings}
            {onToggleHotkey}
            {onHotkeyChange}
            {onToggleSendTabHotkey}
            {onSendTabHotkeyChange}
            {onToggleGalleryHotkey}
            {onGalleryHotkeyChange}
          />
        {/if}
        {#if activeSettingsTab === 'extraction-profiles'}
          <ExtractionProfilesTab
            extractionStore={extractionProfiles}
            {settings}
            {isConfigured}
          />
        {/if}
        {#if activeSettingsTab === 'cookies'}
          <CookiesTab
            {settings}
            {isConfigured}
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
