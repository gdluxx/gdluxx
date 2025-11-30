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
  import SubInputs from './SubInputs.svelte';
  import SubPreview from './SubPreview.svelte';
  import SubProfileControls from './SubProfileControls.svelte';
  import SubQuickApply from './SubQuickApply.svelte';
  import type { ProfileScope } from '#utils/storageProfiles';
  import type { SavedSubProfile } from '#utils/storageSubstitution';
  import { previewSubs, type SubPreviewItem, type SubRule } from '#utils/substitution';

  interface SubSectionProps {
    expanded?: boolean;
    rules?: SubRule[];
    hasActiveSubs?: boolean;
    hasSubRules?: boolean;
    profileScope?: ProfileScope;
    applyToPreview?: boolean;
    applyDefaultSub?: boolean;
    activeSubProfileId?: string | null;
    activeProfileDiffers?: boolean;
    subProfileStatusMessage?: string | null;
    autoAppliedProfile?: boolean;
    isSavingProfile?: boolean;
    hostProfiles?: SavedSubProfile[];
    storageWarning?: string | null;
    modifiedUrls?: ReadonlySet<string>;
    selectedItems?: ReadonlySet<string>;
    previewCount?: number;
    onapply?: () => void;
    onreset?: () => void;
    onsaveprofile?: () => void;
    ondeleteprofile?: () => void;
    onignoreprofile?: () => void;
    onscopechange?: (scope: ProfileScope) => void;
    onapplyprofile?: (id: string) => void;
    onshowscopehelp?: () => void;
    onapplydefaultchange?: (value: boolean) => void;
    onshowregexhelp?: () => void;
  }

  let {
    expanded = $bindable(false),
    rules = $bindable<SubRule[]>([]),
    hasActiveSubs = false,
    hasSubRules = false,
    profileScope = $bindable<ProfileScope>('host'),
    applyToPreview = $bindable(false),
    applyDefaultSub = $bindable(true),
    activeSubProfileId = null,
    activeProfileDiffers = false,
    subProfileStatusMessage = null,
    autoAppliedProfile = false,
    isSavingProfile = false,
    hostProfiles = [] as SavedSubProfile[],
    storageWarning = null,
    modifiedUrls = new Set<string>(),
    selectedItems = new Set<string>(),
    previewCount = 0,
    onapply,
    onreset,
    onsaveprofile,
    ondeleteprofile,
    onignoreprofile,
    onscopechange,
    onapplyprofile,
    onshowscopehelp,
    onapplydefaultchange,
    onshowregexhelp,
  }: SubSectionProps = $props();

  let previewItems = $state<SubPreviewItem[]>([]);

  const selectedCount = $derived(selectedItems.size);
  const modifiedCount = $derived(modifiedUrls.size);
  const hasActiveProfile = $derived(!!activeSubProfileId);

  // Track if all rules are enabled
  const allRulesEnabled = $derived(
    rules.length > 0 && rules.every((rule) => rule.enabled !== false),
  );

  $effect(() => {
    if (!hasActiveSubs || selectedItems.size === 0) {
      previewItems = [];
      return;
    }
    previewItems = previewSubs(Array.from(selectedItems), rules, 5);
  });

  function handleToggleAllRules(enabled: boolean) {
    rules = rules.map((rule) => ({ ...rule, enabled }));
  }
</script>

<AdvancedSection
  title="String Substitution"
  bind:expanded
  hasActiveFilters={hasActiveSubs}
>
  <div class="space-y-6">
    {#if storageWarning}
      <Info>
        {storageWarning}
      </Info>
    {/if}

    <div class="pt-2">
      <SubInputs
        bind:rules
        {onapply}
        {onreset}
        {onshowregexhelp}
      />
    </div>

    <SubProfileControls
      bind:profileScope
      bind:applyToPreview
      bind:applyDefaultSub
      {hasSubRules}
      {hasActiveProfile}
      {activeProfileDiffers}
      {allRulesEnabled}
      profileStatusMessage={subProfileStatusMessage}
      {autoAppliedProfile}
      {isSavingProfile}
      {onsaveprofile}
      {ondeleteprofile}
      {onignoreprofile}
      {onscopechange}
      {onshowscopehelp}
      {onapplydefaultchange}
      ontoggleallrules={handleToggleAllRules}
    />

    <SubQuickApply
      {hostProfiles}
      {onapplyprofile}
    />

    <SubPreview
      {previewCount}
      {selectedCount}
      items={previewItems}
    />

    {#if modifiedCount > 0}
      <Info>
        {modifiedCount} URL{modifiedCount === 1 ? '' : 's'} currently show modified values. Use “Reset
        URLs” to restore the originals.
      </Info>
    {/if}
  </div>
</AdvancedSection>
