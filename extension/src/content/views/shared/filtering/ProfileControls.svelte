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
  import { Button, Dropdown, type DropdownOption } from '#components/ui';
  import Icon from '#components/ui/Icon.svelte';
  import type { ProfileScope } from '#utils/storageProfiles';

  let {
    profileScope = $bindable<ProfileScope>(),
    hasSelectors = false,
    hasActiveProfile = false,
    activeProfileDiffers = false,
    profileStatusMessage = null,
    autoAppliedProfile = false,
    isSavingProfile = false,
    onsaveprofile,
    ondeleteprofile,
    onignoreprofile,
    onscopechange,
    onshowscopehelp,
  }: {
    profileScope?: ProfileScope;
    hasSelectors?: boolean;
    hasActiveProfile?: boolean;
    activeProfileDiffers?: boolean;
    profileStatusMessage?: string | null;
    autoAppliedProfile?: boolean;
    isSavingProfile?: boolean;
    onsaveprofile?: (detail: { scope?: ProfileScope }) => void;
    ondeleteprofile?: () => void;
    onignoreprofile?: () => void;
    onscopechange?: (scope: ProfileScope) => void;
    onshowscopehelp?: () => void;
  } = $props();

  const scopeOptions: DropdownOption<ProfileScope>[] = [
    { value: 'host', label: 'Host' },
    { value: 'origin', label: 'Origin' },
    { value: 'path', label: 'Path' },
  ];

  function handleSaveProfile() {
    onsaveprofile?.({});
  }

  function handleDeleteProfile() {
    ondeleteprofile?.();
  }

  function handleIgnoreProfile() {
    onignoreprofile?.();
  }

  function handleScopeChange(scope: ProfileScope) {
    profileScope = scope;
    onscopechange?.(scope);
  }

  function showScopeHelp() {
    onshowscopehelp?.();
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center gap-2">
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
        onSelect={(value) => handleScopeChange(value as ProfileScope)}
        width="w-30"
        size="sm"
        placeholder="Scope"
        class="join-item"
        variant="neutral"
      />
    </div>
    <Button
      size="sm"
      class="whitespace-nowrap"
      variant="primary"
      onclick={handleSaveProfile}
      disabled={isSavingProfile || !hasSelectors || (hasActiveProfile && !activeProfileDiffers)}
    >
      {hasActiveProfile ? (activeProfileDiffers ? 'Update Saved Range' : 'Saved') : 'Save Range'}
    </Button>
    <Button
      size="sm"
      class="whitespace-nowrap"
      variant="ghost"
      onclick={handleDeleteProfile}
      disabled={!hasActiveProfile}
    >
      Delete
    </Button>
    <Button
      size="sm"
      class="whitespace-nowrap"
      onclick={handleIgnoreProfile}
      disabled={!hasActiveProfile}
    >
      Ignore for Session
    </Button>
  </div>

  {#if hasActiveProfile}
    <div class="text-base-content/70 flex items-center gap-3 text-xs">
      <span>{profileStatusMessage}</span>
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
