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
  import RuleList from './RuleList.svelte';
  import SubPreview from './SubPreview.svelte';
  import ProfileControls from './ProfileControls.svelte';
  import QuickApply from './QuickApply.svelte';
  import type {
    ContainerSource,
    ExtractionConfig,
    ExtractionProfile,
    ImageSource,
  } from '#src/content/types';
  import type { ProfileScope } from '#utils/storageExtractionProfiles';
  import { previewSubs, type SubPreviewItem, type SubRule } from '#utils/substitution';

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
    previewCount?: number;

    onmodechange?: (mode: 'range' | 'targeted') => void;
    onstartselectorchange?: (value: string) => void;
    onendselectorchange?: (value: string) => void;
    oncontainersourcechange?: (source: ContainerSource) => void;
    onimagesourcechange?: (source: ImageSource) => void;

    onapply?: () => void;
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
    previewCount = 0,

    onmodechange,
    onstartselectorchange,
    onendselectorchange,
    oncontainersourcechange,
    onimagesourcechange,

    onapply,
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

  let previewItems = $state<SubPreviewItem[]>([]);

  $effect(() => {
    if (!selectedItems.size) {
      previewItems = [];
      return;
    }
    previewItems = previewSubs(Array.from(selectedItems), rules, 5);
  });
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
      {onapply}
      {onreset}
      {onshowselectorhelp}
    />

    <div class="pt-2">
      <RuleList
        bind:rules
        {onapply}
        {onreset}
        {onshowregexhelp}
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
      {selectedCount}
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
