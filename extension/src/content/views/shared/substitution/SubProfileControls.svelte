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
  import { Badge, Button, Dropdown } from '#components/ui';
  import Icon from '#components/ui/Icon.svelte';
  import type { ProfileScope } from '#utils/storageProfiles';
  import type { DropdownOption } from '#components/ui/Dropdown.svelte';
  import Toggle from '#components/ui/Toggle.svelte';

  interface SubProfileControlsProps {
    profileScope?: ProfileScope | '';
    hasSubRules?: boolean;
    hasActiveProfile?: boolean;
    activeProfileDiffers?: boolean;
    profileStatusMessage?: string | null;
    autoAppliedProfile?: boolean;
    isSavingProfile?: boolean;
    applyToPreview?: boolean;
    applyDefaultSub?: boolean;
    allRulesEnabled?: boolean;
    onsaveprofile?: () => void;
    ondeleteprofile?: () => void;
    onignoreprofile?: () => void;
    onscopechange?: (scope: ProfileScope) => void;
    onshowscopehelp?: () => void;
    onapplydefaultchange?: (value: boolean) => void;
    ontoggleallrules?: (enabled: boolean) => void;
  }

  let {
    profileScope = $bindable<ProfileScope>('' as ProfileScope),
    hasSubRules = false,
    hasActiveProfile = false,
    activeProfileDiffers = false,
    profileStatusMessage = null,
    autoAppliedProfile = false,
    isSavingProfile = false,
    applyToPreview = $bindable(false),
    applyDefaultSub = $bindable(true),
    allRulesEnabled = $bindable(true),
    onsaveprofile,
    ondeleteprofile,
    onignoreprofile,
    onscopechange,
    onshowscopehelp,
    onapplydefaultchange,
    ontoggleallrules,
  }: SubProfileControlsProps = $props();

  const scopeOptions: DropdownOption<ProfileScope>[] = [
    { value: 'host', label: 'Host' },
    { value: 'origin', label: 'Origin' },
    { value: 'path', label: 'Path' },
  ];

  function handleScopeSelect(scope: ProfileScope) {
    profileScope = scope;
    onscopechange?.(scope);
  }

  function handleSaveProfile() {
    onsaveprofile?.();
  }

  function handleDeleteProfile() {
    ondeleteprofile?.();
  }

  function handleIgnoreProfile() {
    onignoreprofile?.();
  }

  function showScopeHelp() {
    onshowscopehelp?.();
  }

  function handleDefaultToggle(event: Event) {
    const next = (event.target as HTMLInputElement).checked;
    applyDefaultSub = next;
    onapplydefaultchange?.(next);
  }

  function handleToggleAllRules() {
    allRulesEnabled = !allRulesEnabled;
    ontoggleallrules?.(allRulesEnabled);
  }
</script>

<div class="mt-2 space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="mr-2 flex items-center gap-2">
      <div class="join">
        <Button
          variant="neutral"
          onclick={showScopeHelp}
          title="Scope Help"
          aria-label="Show scope help"
          class="join-item w-4"
          size="sm"
        >
          <Icon
            iconName="question"
            class="h-4 w-4"
          />
        </Button>
        <Dropdown
          options={scopeOptions}
          selected={profileScope}
          onSelect={(value) => handleScopeSelect(value as ProfileScope)}
          width="w-30"
          size="sm"
          placeholder="Scope"
          class="join-item"
          variant="neutral"
        />
      </div>
      <Button
        class="whitespace-nowrap"
        variant="primary"
        onclick={handleSaveProfile}
        disabled={isSavingProfile || !hasSubRules || (hasActiveProfile && !activeProfileDiffers)}
        title={hasActiveProfile
          ? 'Update the saved substitution profile'
          : 'Save substitution profile'}
        aria-label={hasActiveProfile ? 'Update substitution profile' : 'Save substitution profile'}
        type="button"
        size="sm"
      >
        {#if isSavingProfile}
          <span class="loading loading-sm loading-spinner"></span>
          Saving…
        {:else if hasActiveProfile}
          {activeProfileDiffers ? 'Update profile' : 'Profile saved'}
        {:else}
          Save profile
        {/if}
      </Button>
    </div>
    <div class="flex flex-row items-center gap-2">
      {#if hasActiveProfile}
        <Button
          class="whitespace-nowrap"
          variant="ghost"
          onclick={handleDeleteProfile}
          disabled={!hasActiveProfile}
          title="Delete the saved substitution profile"
          aria-label="Delete substitution profile"
          type="button"
          size="sm"
        >
          Delete
        </Button>
        <Button
          class="whitespace-nowrap"
          variant="ghost"
          onclick={handleIgnoreProfile}
          disabled={!hasActiveProfile || !autoAppliedProfile}
          title="Ignore auto-applied profile for this session"
          aria-label="Ignore profile"
          type="button"
          size="sm"
        >
          Ignore
        </Button>
      {/if}
      {#if hasSubRules}
        <div class="flex items-center">
          <label
            class="text-base-content/70 flex w-32 cursor-pointer items-center justify-between gap-1 text-sm"
          >
            <span>{allRulesEnabled ? 'Disable All' : 'Enable All'}</span>
            <Toggle
              checked={allRulesEnabled}
              onchange={handleToggleAllRules}
              variant="accent"
              size="xs"
            />
          </label>
        </div>
      {/if}
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-4 text-xs">
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        class="checkbox checkbox-xs checkbox-secondary"
        bind:checked={applyToPreview}
        aria-label="Apply substitution results to previews"
      />
      <span class="text-base-content/70">Apply to previews</span>
    </label>
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        class="checkbox checkbox-xs checkbox-secondary"
        checked={applyDefaultSub}
        onchange={handleDefaultToggle}
        aria-label="Automatically apply saved substitution profile"
      />
      <span class="text-base-content/70">Auto-apply saved profile on open</span>
    </label>
  </div>

  {#if hasActiveProfile}
    <div class="text-base-content/70 flex flex-wrap items-center gap-3 text-xs">
      {#if profileStatusMessage}
        <Badge
          label={profileStatusMessage}
          variant="outline-primary"
        />
      {/if}
      {#if activeProfileDiffers}
        <span class="text-warning font-semibold">Unsaved changes</span>
      {:else}
        <span class="text-success font-semibold">In sync</span>
      {/if}
      {#if autoAppliedProfile}
        <span class="text-info">Auto-applied</span>
      {/if}
    </div>
  {/if}
</div>
