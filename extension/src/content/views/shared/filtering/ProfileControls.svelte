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
  import { Button } from '#components/ui';
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

  function handleSaveProfile() {
    onsaveprofile?.({});
  }

  function handleDeleteProfile() {
    ondeleteprofile?.();
  }

  function handleIgnoreProfile() {
    onignoreprofile?.();
  }

  function handleScopeChange(e: Event) {
    const scope = (e.target as HTMLSelectElement).value as ProfileScope;
    profileScope = scope;
    onscopechange?.(scope);
  }

  function showScopeHelp() {
    onshowscopehelp?.();
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-center gap-2">
    <label class="text-base-content/70 flex items-center gap-1 text-xs">
      Scope
      <button
        class="btn btn-circle btn-ghost btn-xs"
        onclick={showScopeHelp}
        title="Scope Help"
        aria-label="Show scope help"
      >
        <Icon
          iconName="question"
          class="h-3 w-3"
        />
      </button>
      <select
        class="select-bordered select focus:select-primary ml-2"
        bind:value={profileScope}
        onchange={handleScopeChange}
      >
        <option value="host">Host</option>
        <option value="origin">Origin</option>
        <option value="path">Path</option>
      </select>
    </label>
    <Button
      class="whitespace-nowrap"
      variant="primary"
      onclick={handleSaveProfile}
      disabled={isSavingProfile || !hasSelectors || (hasActiveProfile && !activeProfileDiffers)}
    >
      {hasActiveProfile ? (activeProfileDiffers ? 'Update Saved Range' : 'Saved') : 'Save Range'}
    </Button>
    <Button
      class="whitespace-nowrap"
      variant="ghost"
      onclick={handleDeleteProfile}
      disabled={!hasActiveProfile}
    >
      Delete
    </Button>
    <Button
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
