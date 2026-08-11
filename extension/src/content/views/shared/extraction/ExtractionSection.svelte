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
  import { AdvancedSection, Info } from '#components/ui';
  import ContainerModeTab from './ContainerModeTab.svelte';
  import DirectorySourceConfig from './DirectorySourceConfig.svelte';
  import RuleList from './RuleList.svelte';
  import SubPreview from './SubPreview.svelte';
  import ProfileControls from './ProfileControls.svelte';
  import QuickApply from './QuickApply.svelte';
  import type {
    ContainerSource,
    DirectorySource,
    ExtractionConfig,
    ExtractionProfile,
    ImageSource,
  } from '#src/content/types';
  import type { ProfileScope } from '#utils/storageExtractionProfiles';
  import { PREVIEW_SAMPLE_LIMIT, summarisePreview, type SubRule } from '#utils/substitution';

  interface ExtractionSectionProps {
    expanded?: boolean;
    extraction?: ExtractionConfig;
    rules?: SubRule[];
    profileScope?: ProfileScope;
    applyToPreview?: boolean;
    hasActiveContent?: boolean;
    hasActiveProfile?: boolean;
    activeProfileDiffers?: boolean;
    statusMessage?: string | null;
    autoAppliedProfile?: boolean;
    isSaving?: boolean;
    hostProfiles?: ExtractionProfile[];
    rangeHint?: string | null;
    storageWarning?: string | null;
    modifiedUrls?: ReadonlySet<string>;
    selectedItems?: ReadonlySet<string>;
    allExtractedUrls?: readonly string[];
    directorySource?: DirectorySource | null;
    accumulate?: boolean;

    onmodechange?: (mode: 'range' | 'targeted') => void;
    ondirectorysourcechange?: (source: DirectorySource | null | undefined) => void;
    onaccumulatechange?: (value: boolean) => void;
    onstartselectorchange?: (value: string) => void;
    onendselectorchange?: (value: string) => void;
    oncontainersourcechange?: (source: ContainerSource) => void;
    onimagesourcechange?: (source: ImageSource) => void;

    onapplyextraction?: () => void;
    onapplysubstitutions?: () => void;
    onreset?: () => void;

    onsaveprofile?: () => void;
    ondeleteprofile?: () => void;
    onignoreprofile?: () => void;
    onscopechange?: (scope: ProfileScope) => void;
    onapplyprofile?: (id: string) => void;
    onapplytopreviewchange?: (value: boolean) => void;

    onshowscopehelp?: () => void;
    onshowselectorhelp?: () => void;
    onshowregexhelp?: () => void;
  }

  let {
    expanded = $bindable(false),
    extraction = $bindable<ExtractionConfig>({ mode: 'range', startSelector: '', endSelector: '' }),
    rules = $bindable<SubRule[]>([]),
    profileScope = $bindable<ProfileScope>('host'),
    applyToPreview = $bindable(false),
    hasActiveContent = false,
    hasActiveProfile = false,
    activeProfileDiffers = false,
    statusMessage = null,
    autoAppliedProfile = false,
    isSaving = false,
    hostProfiles = [],
    rangeHint = null,
    storageWarning = null,
    modifiedUrls = new Set<string>(),
    selectedItems = new Set<string>(),
    allExtractedUrls = [],
    directorySource = undefined,
    accumulate = false,

    onmodechange,
    ondirectorysourcechange,
    onaccumulatechange,
    onstartselectorchange,
    onendselectorchange,
    oncontainersourcechange,
    onimagesourcechange,

    onapplyextraction,
    onapplysubstitutions,
    onreset,

    onsaveprofile,
    ondeleteprofile,
    onignoreprofile,
    onscopechange,
    onapplyprofile,
    onapplytopreviewchange,

    onshowscopehelp,
    onshowselectorhelp,
    onshowregexhelp,
  }: ExtractionSectionProps = $props();

  const selectedCount = $derived(selectedItems.size);
  const modifiedCount = $derived(modifiedUrls.size);
  const isPreviewSample = $derived(selectedCount === 0 && allExtractedUrls.length > 0);
  const previewSourceUrls = $derived(
    isPreviewSample ? allExtractedUrls.slice(0, PREVIEW_SAMPLE_LIMIT) : Array.from(selectedItems),
  );
  const previewSummary = $derived(summarisePreview(previewSourceUrls, rules, 5));
  const previewItems = $derived(previewSummary.items);
  const previewCount = $derived(previewSummary.changedCount);
  const previewSourceCount = $derived(previewSourceUrls.length);
  const previewSampleTotal = $derived(isPreviewSample ? allExtractedUrls.length : 0);
</script>

<AdvancedSection
  title="Extraction"
  bind:expanded
  hasActiveFilters={hasActiveContent}
>
  <div class="space-y-6">
    {#if storageWarning}
      <Info>
        {storageWarning}
      </Info>
    {/if}

    <ContainerModeTab
      {extraction}
      {rangeHint}
      {onmodechange}
      {onstartselectorchange}
      {onendselectorchange}
      {oncontainersourcechange}
      {onimagesourcechange}
      onapply={onapplyextraction}
      {onreset}
      {onshowselectorhelp}
    />

    {#if extraction.mode === 'targeted'}
      <div class="space-y-1">
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-xs checkbox-secondary rounded-sm"
            checked={accumulate}
            onchange={(e) => onaccumulatechange?.((e.target as HTMLInputElement).checked)}
            aria-label="Accumulate images while scrolling"
          />
          <span class="text-base-content/70 text-sm">Accumulate images while scrolling</span>
        </label>
        <p class="text-base-content/50 text-xs">
          Keeps collecting matching images as the page loads more. Saved with the profile.
        </p>
      </div>
    {/if}

    <div class="pt-2">
      <RuleList
        bind:rules
        {selectedCount}
        {modifiedCount}
        onapply={onapplysubstitutions}
        {onreset}
        {onshowregexhelp}
      />
    </div>

    <div class="space-y-2 pt-2">
      <p class="text-base-content/70 text-sm">
        Download folder from page - reads a folder name off this page and fills the custom folder
        field when the profile is applied.
      </p>
      <DirectorySourceConfig
        {directorySource}
        {ondirectorysourcechange}
      />
    </div>

    <ProfileControls
      bind:scope={profileScope}
      bind:applyToPreview
      hasContent={hasActiveContent}
      {hasActiveProfile}
      {activeProfileDiffers}
      {statusMessage}
      {autoAppliedProfile}
      {isSaving}
      {onsaveprofile}
      {ondeleteprofile}
      {onignoreprofile}
      {onscopechange}
      {onshowscopehelp}
      {onapplytopreviewchange}
    />

    <QuickApply
      {hostProfiles}
      {onapplyprofile}
    />

    <SubPreview
      {previewCount}
      sourceCount={previewSourceCount}
      isSample={isPreviewSample}
      sampleTotal={previewSampleTotal}
      items={previewItems}
    />

    {#if modifiedCount > 0}
      <Info
        variant="info"
        size="sm"
        soft
      >
        <span class="text-lg">
          {modifiedCount} URL{modifiedCount === 1 ? '' : 's'} currently show modified values. Use "Reset
          URLs" to restore the originals.
        </span>
      </Info>
    {/if}
  </div>
</AdvancedSection>
