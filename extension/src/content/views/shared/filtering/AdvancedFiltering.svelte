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
  import { AdvancedSection } from '#components/ui';
  import { Info } from '#components/ui';
  import SelectorInputs from './SelectorInputs.svelte';
  import ProfileControls from './ProfileControls.svelte';
  import QuickApply from './QuickApply.svelte';
  import type { SavedSelectorProfile, ProfileScope } from '#utils/storageProfiles';

  interface AdvancedFilteringProps {
    expanded?: boolean;
    startSelector?: string;
    endSelector?: string;
    profileScope?: ProfileScope;
    hasActiveFilters?: boolean;
    hasSelectors?: boolean;
    hasActiveProfile?: boolean;
    activeProfileDiffers?: boolean;
    profileStatusMessage?: string | null;
    autoAppliedProfile?: boolean;
    isSavingProfile?: boolean;
    hostProfiles?: SavedSelectorProfile[];
    rangeHint?: string | null;
    storageWarning?: string | null;
    onapply?: () => void;
    onreset?: () => void;
    onsaveprofile?: (detail: { scope?: ProfileScope }) => void;
    ondeleteprofile?: () => void;
    onignoreprofile?: () => void;
    onscopechange?: (scope: ProfileScope) => void;
    onapplyprofile?: (profileId: string) => void;
    onshowselectorhelp?: () => void;
    onshowscopehelp?: () => void;
  }

  let {
    expanded = $bindable(false),
    startSelector = $bindable(''),
    endSelector = $bindable(''),
    profileScope = $bindable<ProfileScope>('host'),
    hasActiveFilters = false,
    hasSelectors = false,
    hasActiveProfile = false,
    activeProfileDiffers = false,
    profileStatusMessage = null,
    autoAppliedProfile = false,
    isSavingProfile = false,
    hostProfiles = [],
    rangeHint = null,
    storageWarning = null,
    onapply,
    onreset,
    onsaveprofile,
    ondeleteprofile,
    onignoreprofile,
    onscopechange,
    onapplyprofile,
    onshowselectorhelp,
    onshowscopehelp,
  }: AdvancedFilteringProps = $props();
</script>

<AdvancedSection
  title="Advanced Filtering"
  bind:expanded
  {hasActiveFilters}
  class="overflow-visible"
>
  <div class="space-y-4">
    <SelectorInputs
      bind:startSelector
      bind:endSelector
      {onapply}
      {onreset}
      {onshowselectorhelp}
    />

    {#if rangeHint}
      <Info soft>
        {rangeHint}
      </Info>
    {/if}
    {#if storageWarning}
      <Info>
        {storageWarning}
      </Info>
    {/if}

    <ProfileControls
      bind:profileScope
      {hasSelectors}
      {hasActiveProfile}
      {activeProfileDiffers}
      {profileStatusMessage}
      {autoAppliedProfile}
      {isSavingProfile}
      {onsaveprofile}
      {ondeleteprofile}
      {onignoreprofile}
      {onscopechange}
      {onshowscopehelp}
    />

    <QuickApply
      {hostProfiles}
      {onapplyprofile}
    />
  </div>
</AdvancedSection>
